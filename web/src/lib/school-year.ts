import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/auth";
import { zonedParts } from "@/lib/datetime";

/** Bornes d’une année scolaire gabonaise (sept. → juil.). */
export function schoolYearBoundsForStartYear(startYear: number) {
  const endYear = startYear + 1;
  return {
    label: `${startYear}-${endYear}`,
    startsOn: new Date(`${startYear}-09-01T00:00:00+01:00`),
    endsOn: new Date(`${endYear}-07-15T00:00:00+01:00`),
  };
}

/**
 * Année scolaire de référence (affichage / création).
 * Sept. N → août N+1 = année N-(N+1). Pas de bascule auto.
 */
export function currentSchoolYearBounds(now = new Date()) {
  const { year, month } = zonedParts(now);
  const startYear = month >= 9 ? year : year - 1;
  return schoolYearBoundsForStartYear(startYear);
}

/** Ex. « 2025-2026 » → année suivante « 2026-2027 ». */
export function nextSchoolYearFromLabel(label: string) {
  const match = /^(\d{4})\s*[-/]\s*(\d{4})$/.exec(label.trim());
  if (!match) return currentSchoolYearBounds();
  const startYear = Number(match[1]) + 1;
  return schoolYearBoundsForStartYear(startYear);
}

export function parseSchoolYearStart(label: string) {
  const match = /^(\d{4})\s*[-/]\s*(\d{4})$/.exec(label.trim());
  return match ? Number(match[1]) : null;
}

type EnsureResult = {
  changed: boolean;
  current: { id: string; label: string };
  archivedLabels: string[];
};

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

async function advanceOneYear(
  tx: Tx,
  schoolId: string,
  fromYearId: string,
  nextBounds: ReturnType<typeof nextSchoolYearFromLabel>,
  copyClassrooms: boolean,
) {
  await tx.schoolYear.updateMany({
    where: { schoolId, isCurrent: true },
    data: { isCurrent: false },
  });

  let next = await tx.schoolYear.findFirst({
    where: { schoolId, label: nextBounds.label },
  });

  if (!next) {
    next = await tx.schoolYear.create({
      data: {
        schoolId,
        label: nextBounds.label,
        startsOn: nextBounds.startsOn,
        endsOn: nextBounds.endsOn,
        isCurrent: true,
      },
    });
  } else {
    next = await tx.schoolYear.update({
      where: { id: next.id },
      data: { isCurrent: true },
    });
  }

  if (copyClassrooms) {
    const oldClasses = await tx.classroom.findMany({
      where: {
        schoolId,
        schoolYearId: fromYearId,
        deletedAt: null,
      },
    });

    for (const roomClass of oldClasses) {
      const already = await tx.classroom.findFirst({
        where: {
          schoolId,
          schoolYearId: next.id,
          name: roomClass.name,
          deletedAt: null,
        },
      });
      const newClass =
        already ||
        (await tx.classroom.create({
          data: {
            schoolId,
            schoolYearId: next.id,
            name: roomClass.name,
            level: roomClass.level,
            notes: roomClass.notes,
          },
        }));

      await tx.room.updateMany({
        where: {
          schoolId,
          homeClassroomId: roomClass.id,
          deletedAt: null,
        },
        data: { homeClassroomId: newClass.id },
      });
    }
  }

  return next;
}

/**
 * Garantit qu’une année « courante » existe.
 * Ne bascule jamais automatiquement — uniquement via l’admin national.
 */
export async function ensureSchoolYearCurrent(
  schoolId: string,
): Promise<EnsureResult> {
  const school = await prisma.school.findUnique({
    where: { id: schoolId },
    select: { id: true },
  });
  if (!school) {
    throw new Error("SCHOOL_NOT_FOUND");
  }

  const current = await prisma.schoolYear.findFirst({
    where: { schoolId, isCurrent: true },
  });

  if (current) {
    return {
      changed: false,
      current: { id: current.id, label: current.label },
      archivedLabels: [],
    };
  }

  const latest = await prisma.schoolYear.findFirst({
    where: { schoolId },
    orderBy: { startsOn: "desc" },
  });

  if (latest) {
    const updated = await prisma.schoolYear.update({
      where: { id: latest.id },
      data: { isCurrent: true },
    });
    return {
      changed: true,
      current: { id: updated.id, label: updated.label },
      archivedLabels: [],
    };
  }

  const bounds = currentSchoolYearBounds();
  const created = await prisma.schoolYear.create({
    data: {
      schoolId,
      label: bounds.label,
      startsOn: bounds.startsOn,
      endsOn: bounds.endsOn,
      isCurrent: true,
    },
  });
  return {
    changed: true,
    current: { id: created.id, label: created.label },
    archivedLabels: [],
  };
}

/**
 * Bascule manuelle : archive l’année en cours et ouvre la suivante.
 * Aucune suppression. Optionnellement reprend les classes.
 */
export async function openNextSchoolYear(
  schoolId: string,
  options: { copyClassrooms?: boolean } = {},
): Promise<EnsureResult> {
  const copyClassrooms = options.copyClassrooms !== false;

  const current = await prisma.schoolYear.findFirst({
    where: { schoolId, isCurrent: true },
  });

  if (!current) {
    const bounds = currentSchoolYearBounds();
    const created = await prisma.schoolYear.create({
      data: {
        schoolId,
        label: bounds.label,
        startsOn: bounds.startsOn,
        endsOn: bounds.endsOn,
        isCurrent: true,
      },
    });
    return {
      changed: true,
      current: { id: created.id, label: created.label },
      archivedLabels: [],
    };
  }

  const nextBounds = nextSchoolYearFromLabel(current.label);
  const opened = await prisma.$transaction((tx) =>
    advanceOneYear(tx, schoolId, current.id, nextBounds, copyClassrooms),
  );

  await audit("school_year.manual_rollover", {
    schoolId,
    entityType: "school_year",
    entityId: opened.id,
    meta: {
      archivedLabel: current.label,
      openedLabel: opened.label,
      copyClassrooms,
      trigger: "national_admin",
    },
  });

  return {
    changed: true,
    current: { id: opened.id, label: opened.label },
    archivedLabels: [current.label],
  };
}
