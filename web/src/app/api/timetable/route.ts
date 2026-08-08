import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { audit, getSession } from "@/lib/auth";

async function requireAdmin() {
  const session = await getSession();
  if (!session?.schoolId || !["school_admin", "national_admin"].includes(session.role)) {
    return null;
  }
  return session;
}

export async function GET(req: Request) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ message: "Accès refusé" }, { status: 403 });

  const url = new URL(req.url);
  const classroomId = url.searchParams.get("classroomId") || undefined;
  const weekStartParam = url.searchParams.get("weekStart"); // YYYY-MM-DD (Monday)

  let weekStart: Date | null = null;
  let weekEnd: Date | null = null;
  if (weekStartParam && /^\d{4}-\d{2}-\d{2}$/.test(weekStartParam)) {
    const [y, m, d] = weekStartParam.split("-").map(Number);
    weekStart = new Date(y, m - 1, d, 0, 0, 0, 0);
    weekEnd = new Date(y, m - 1, d, 23, 59, 59, 999);
    weekEnd.setDate(weekEnd.getDate() + 6);
  }

  const [slots, classrooms, rooms, subjects, teachers, year] = await Promise.all([
    prisma.timetableSlot.findMany({
      where: {
        schoolId: session.schoolId!,
        deletedAt: null,
        ...(classroomId ? { classroomId } : {}),
        ...(weekStart && weekEnd
          ? {
              effectiveFrom: { lte: weekEnd },
              OR: [{ effectiveTo: null }, { effectiveTo: { gte: weekStart } }],
            }
          : {}),
      },
      include: {
        room: true,
        classroom: true,
        subject: true,
        teacher: true,
      },
      orderBy: [{ weekday: "asc" }, { startsAt: "asc" }],
    }),
    prisma.classroom.findMany({
      where: { schoolId: session.schoolId!, deletedAt: null },
      orderBy: { name: "asc" },
    }),
    prisma.room.findMany({
      where: { schoolId: session.schoolId!, deletedAt: null, isActive: true },
      include: { homeClassroom: { select: { id: true, name: true } } },
      orderBy: { code: "asc" },
    }),
    prisma.subject.findMany({
      where: { schoolId: session.schoolId! },
      orderBy: { name: "asc" },
    }),
    prisma.user.findMany({
      where: {
        schoolId: session.schoolId!,
        role: "teacher",
        deletedAt: null,
        isActive: true,
      },
      orderBy: { lastName: "asc" },
    }),
    prisma.schoolYear.findFirst({
      where: { schoolId: session.schoolId!, isCurrent: true },
    }),
  ]);

  return NextResponse.json({
    slots,
    week: weekStartParam
      ? { start: weekStartParam, end: weekEnd ? weekEnd.toISOString().slice(0, 10) : null }
      : null,
    meta: {
      classrooms,
      rooms: rooms.map((r) => ({
        id: r.id,
        code: r.code,
        label: r.homeClassroom?.name || r.label,
        homeClassroomId: r.homeClassroomId,
        name: `${r.code} · ${r.homeClassroom?.name || r.label}`,
      })),
      subjects,
      teachers,
      schoolYearId: year?.id ?? null,
    },
  });
}

function parseHm(v: string) {
  return /^\d{2}:\d{2}$/.test(v);
}

export async function POST(req: Request) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ message: "Accès refusé" }, { status: 403 });

  const body = await req.json();
  const year = await prisma.schoolYear.findFirst({
    where: { schoolId: session.schoolId!, isCurrent: true },
  });
  if (!year) {
    return NextResponse.json({ message: "Aucune année scolaire active" }, { status: 422 });
  }

  const weekday = String(body.weekday || "");
  const startsAt = String(body.startsAt || "");
  const endsAt = String(body.endsAt || "");
  const classroomId = String(body.classroomId || "");
  const subjectId = String(body.subjectId || "");
  const teacherId = String(body.teacherId || "");

  let roomId = String(body.roomId || "");
  if (!roomId && classroomId) {
    const linked = await prisma.room.findFirst({
      where: {
        schoolId: session.schoolId!,
        homeClassroomId: classroomId,
        deletedAt: null,
      },
      orderBy: { createdAt: "asc" },
    });
    roomId = linked?.id || "";
  }
  if (!roomId) {
    const fallback = await prisma.room.findFirst({
      where: { schoolId: session.schoolId!, deletedAt: null, isActive: true },
      orderBy: { code: "asc" },
    });
    roomId = fallback?.id || "";
  }

  if (
    !["mon", "tue", "wed", "thu", "fri", "sat", "sun"].includes(weekday) ||
    !parseHm(startsAt) ||
    !parseHm(endsAt) ||
    endsAt <= startsAt ||
    !roomId ||
    !classroomId ||
    !subjectId ||
    !teacherId
  ) {
    return NextResponse.json(
      {
        message: roomId
          ? "Données créneau invalides"
          : "Aucune salle liée à cette classe. Créez d’abord le QR de la classe.",
      },
      { status: 400 },
    );
  }

  const slot = await prisma.timetableSlot.create({
    data: {
      schoolId: session.schoolId!,
      schoolYearId: year.id,
      weekday,
      startsAt,
      endsAt,
      roomId,
      classroomId,
      subjectId,
      teacherId,
      effectiveFrom: year.startsOn,
    },
    include: {
      room: true,
      classroom: true,
      subject: true,
      teacher: true,
    },
  });

  await audit("timetable.create", {
    schoolId: session.schoolId,
    actorId: session.sub,
    entityType: "timetable_slot",
    entityId: slot.id,
  });

  return NextResponse.json(slot, { status: 201 });
}
