import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { audit, getSession } from "@/lib/auth";

const WEEKDAY_ALIASES: Record<string, string> = {
  lun: "mon",
  lundi: "mon",
  mon: "mon",
  monday: "mon",
  mar: "tue",
  mardi: "tue",
  tue: "tue",
  tuesday: "tue",
  mer: "wed",
  mercredi: "wed",
  wed: "wed",
  wednesday: "wed",
  jeu: "thu",
  jeudi: "thu",
  thu: "thu",
  thursday: "thu",
  ven: "fri",
  vendredi: "fri",
  fri: "fri",
  friday: "fri",
  sam: "sat",
  samedi: "sat",
  sat: "sat",
  saturday: "sat",
  dim: "sun",
  dimanche: "sun",
  sun: "sun",
  sunday: "sun",
};

function parseCsv(text: string) {
  const lines = text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length < 2) return [];

  const headers = lines[0].split(/[;,]/).map((h) => h.trim().toLowerCase());
  const idx = (name: string) => headers.indexOf(name);

  const required = [
    "weekday",
    "startsat",
    "endsat",
    "roomcode",
    "classroom",
    "subjectcode",
    "teacheremail",
  ];
  for (const r of required) {
    if (idx(r) < 0) throw new Error(`Colonne manquante: ${r}`);
  }

  return lines.slice(1).map((line) => {
    const cols = line.split(/[;,]/).map((c) => c.trim());
    return {
      weekday: cols[idx("weekday")],
      startsAt: cols[idx("startsat")],
      endsAt: cols[idx("endsat")],
      roomCode: cols[idx("roomcode")],
      classroom: cols[idx("classroom")],
      subjectCode: cols[idx("subjectcode")],
      teacherEmail: cols[idx("teacheremail")].toLowerCase(),
    };
  });
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session?.schoolId || !["school_admin", "national_admin"].includes(session.role)) {
    return NextResponse.json({ message: "Accès refusé" }, { status: 403 });
  }

  const body = await req.json();
  const csv = String(body.csv || "");
  const replaceClassroomId = body.replaceClassroomId
    ? String(body.replaceClassroomId)
    : null;

  let rows: ReturnType<typeof parseCsv>;
  try {
    rows = parseCsv(csv);
  } catch (e) {
    return NextResponse.json(
      { message: e instanceof Error ? e.message : "CSV invalide" },
      { status: 400 },
    );
  }

  const year = await prisma.schoolYear.findFirst({
    where: { schoolId: session.schoolId, isCurrent: true },
  });
  if (!year) {
    return NextResponse.json({ message: "Aucune année scolaire active" }, { status: 422 });
  }

  const [rooms, classrooms, subjects, teachers] = await Promise.all([
    prisma.room.findMany({ where: { schoolId: session.schoolId, deletedAt: null } }),
    prisma.classroom.findMany({
      where: { schoolId: session.schoolId, deletedAt: null },
    }),
    prisma.subject.findMany({ where: { schoolId: session.schoolId } }),
    prisma.user.findMany({
      where: { schoolId: session.schoolId, role: "teacher", deletedAt: null },
    }),
  ]);

  const roomByCode = new Map(rooms.map((r) => [r.code.toLowerCase(), r]));
  const classByName = new Map(classrooms.map((c) => [c.name.toLowerCase(), c]));
  const subjectByCode = new Map(subjects.map((s) => [s.code.toLowerCase(), s]));
  const teacherByEmail = new Map(
    teachers.filter((t) => t.email).map((t) => [t.email!.toLowerCase(), t]),
  );

  if (replaceClassroomId) {
    await prisma.timetableSlot.updateMany({
      where: {
        schoolId: session.schoolId,
        classroomId: replaceClassroomId,
        deletedAt: null,
      },
      data: { deletedAt: new Date() },
    });
  }

  const created = [];
  const errors: string[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const weekday = WEEKDAY_ALIASES[row.weekday.toLowerCase()];
    const room = roomByCode.get(row.roomCode.toLowerCase());
    const classroom = classByName.get(row.classroom.toLowerCase());
    const subject = subjectByCode.get(row.subjectCode.toLowerCase());
    const teacher = teacherByEmail.get(row.teacherEmail);

    if (!weekday || !room || !classroom || !subject || !teacher) {
      errors.push(
        `Ligne ${i + 2}: données introuvables (jour/salle/classe/matière/enseignant)`,
      );
      continue;
    }
    if (!/^\d{2}:\d{2}$/.test(row.startsAt) || !/^\d{2}:\d{2}$/.test(row.endsAt)) {
      errors.push(`Ligne ${i + 2}: horaires invalides`);
      continue;
    }

    const slot = await prisma.timetableSlot.create({
      data: {
        schoolId: session.schoolId!,
        schoolYearId: year.id,
        weekday,
        startsAt: row.startsAt,
        endsAt: row.endsAt,
        roomId: room.id,
        classroomId: classroom.id,
        subjectId: subject.id,
        teacherId: teacher.id,
        effectiveFrom: year.startsOn,
      },
    });
    created.push(slot.id);
  }

  await audit("timetable.import", {
    schoolId: session.schoolId,
    actorId: session.sub,
    entityType: "timetable",
    meta: { created: created.length, errors: errors.length },
  });

  return NextResponse.json({
    created: created.length,
    errors,
  });
}
