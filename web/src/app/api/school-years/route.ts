import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import {
  currentSchoolYearBounds,
  ensureSchoolYearCurrent,
  openNextSchoolYear,
} from "@/lib/school-year";

async function requireSchoolAdmin() {
  const session = await getSession();
  if (!session?.schoolId || session.role !== "school_admin") return null;
  return session;
}

async function requireNational() {
  const session = await getSession();
  if (!session || session.role !== "national_admin") return null;
  return session;
}

/** Lecture année scolaire — direction d’établissement (lecture seule). */
export async function GET() {
  const session = await requireSchoolAdmin();
  if (!session) {
    return NextResponse.json({ message: "Accès refusé" }, { status: 403 });
  }

  const rollover = await ensureSchoolYearCurrent(session.schoolId!);

  const years = await prisma.schoolYear.findMany({
    where: { schoolId: session.schoolId! },
    orderBy: { startsOn: "desc" },
    include: {
      _count: {
        select: {
          classrooms: true,
          slots: true,
          sessions: true,
        },
      },
    },
  });

  const current = years.find((y) => y.isCurrent) || null;
  const calendar = currentSchoolYearBounds();

  return NextResponse.json({
    rollover,
    calendarYear: calendar.label,
    autoArchiveNote:
      "La bascule d’année est réservée à l’admin national. Aucune donnée n’est supprimée.",
    current: current
      ? {
          id: current.id,
          label: current.label,
          startsOn: current.startsOn,
          endsOn: current.endsOn,
          counts: current._count,
        }
      : null,
    years: years.map((y) => ({
      id: y.id,
      label: y.label,
      isCurrent: y.isCurrent,
      startsOn: y.startsOn,
      endsOn: y.endsOn,
      counts: y._count,
    })),
  });
}

/** Bascule manuelle globale — admin national uniquement (tous les établissements). */
export async function POST(req: Request) {
  const session = await requireNational();
  if (!session) {
    return NextResponse.json({ message: "Accès refusé" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const copyClassrooms = body?.copyClassrooms !== false;

  const schools = await prisma.school.findMany({
    select: { id: true, name: true, code: true },
    orderBy: { name: "asc" },
  });
  const results = [];
  for (const school of schools) {
    const result = await openNextSchoolYear(school.id, { copyClassrooms });
    results.push({
      schoolId: school.id,
      schoolName: school.name,
      schoolCode: school.code,
      ...result,
    });
  }
  return NextResponse.json({
    ok: true,
    processed: results.length,
    results,
  });
}
