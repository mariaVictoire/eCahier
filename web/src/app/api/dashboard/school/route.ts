import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { getWeekday, startOfDay } from "@/lib/slot";
import {
  formatHmGabon,
  startOfDayGabon,
  zonedParts,
} from "@/lib/datetime";
import { addDays, startOfWeekMonday } from "@/lib/calendar";
import { ensureSchoolYearCurrent } from "@/lib/school-year";
import {
  closedPeriodForDay,
  loadHolidayPeriods,
} from "@/lib/holidays";

function pct(done: number, expected: number) {
  if (expected === 0) return 100;
  return Math.round((done / expected) * 1000) / 10;
}

export async function GET() {
  const session = await getSession();
  if (!session?.schoolId) {
    return NextResponse.json({ message: "Non authentifié" }, { status: 401 });
  }
  if (!["school_admin", "national_admin"].includes(session.role)) {
    return NextResponse.json({ message: "Accès refusé" }, { status: 403 });
  }

  try {
    await ensureSchoolYearCurrent(session.schoolId);
  } catch (err) {
    if (err instanceof Error && err.message === "SCHOOL_NOT_FOUND") {
      return NextResponse.json(
        {
          message:
            "Établissement introuvable. Déconnectez-vous puis reconnectez-vous.",
        },
        { status: 404 },
      );
    }
    console.error("[dashboard/school]", err);
    return NextResponse.json(
      { message: "Impossible de charger le tableau de bord" },
      { status: 500 },
    );
  }

  const now = new Date();
  const today = startOfDay(now);
  const weekday = getWeekday(now);
  const nowHm = formatHmGabon(now);
  const schoolId = session.schoolId;
  const parts = zonedParts(now);

  const weekStartLocal = startOfWeekMonday(
    new Date(parts.year, parts.month - 1, parts.day, 12, 0, 0),
  );
  const weekStart = startOfDayGabon(weekStartLocal);
  const monthStart = startOfDayGabon(
    new Date(parts.year, parts.month - 1, 1, 12, 0, 0),
  );

  const [
    slotsToday,
    sessionsToday,
    allSlots,
    weekSessions,
    monthSessions,
    school,
    admin,
    teachersCount,
    classroomsCount,
    roomsActiveCount,
    subjectsCount,
    holidayPeriods,
  ] = await Promise.all([
    prisma.timetableSlot.findMany({
      where: { schoolId, weekday, deletedAt: null },
      include: { teacher: true, classroom: true, subject: true },
      orderBy: { startsAt: "asc" },
    }),
    prisma.lessonSession.findMany({
      where: { schoolId, sessionDate: today, deletedAt: null },
      include: { teacher: true, classroom: true, subject: true },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.timetableSlot.findMany({
      where: { schoolId, deletedAt: null },
      select: { weekday: true },
    }),
    prisma.lessonSession.findMany({
      where: {
        schoolId,
        deletedAt: null,
        sessionDate: { gte: weekStart, lte: today },
      },
      select: { id: true, sessionDate: true, status: true },
    }),
    prisma.lessonSession.findMany({
      where: {
        schoolId,
        deletedAt: null,
        sessionDate: { gte: monthStart, lte: today },
      },
      select: { id: true },
    }),
    prisma.school.findUnique({ where: { id: schoolId } }),
    prisma.user.findUnique({ where: { id: session.sub } }),
    prisma.user.count({
      where: {
        schoolId,
        role: "teacher",
        isActive: true,
        deletedAt: null,
      },
    }),
    prisma.classroom.count({
      where: { schoolId, deletedAt: null },
    }),
    prisma.room.count({
      where: { schoolId, isActive: true, deletedAt: null },
    }),
    prisma.subject.count({ where: { schoolId } }),
    loadHolidayPeriods(now),
  ]);

  const todayClosed = closedPeriodForDay(now, holidayPeriods);

  const filledSlotIds = new Set(
    sessionsToday.filter((s) => s.slotId).map((s) => s.slotId as string),
  );

  const activeSlotsToday = todayClosed ? [] : slotsToday;
  const missing = activeSlotsToday.filter((s) => !filledSlotIds.has(s.id));
  const overdueMissing = missing.filter((s) => s.endsAt <= nowHm);
  const upcomingMissing = missing.filter((s) => s.endsAt > nowHm);

  const done = sessionsToday.length;
  const expected = activeSlotsToday.length;
  const fillRate = pct(done, expected);
  const validatedToday = sessionsToday.filter((s) => s.status === "validated").length;
  const draftToday = sessionsToday.filter((s) => s.status === "draft").length;

  const slotsByWeekday = new Map<string, number>();
  for (const s of allSlots) {
    slotsByWeekday.set(s.weekday, (slotsByWeekday.get(s.weekday) || 0) + 1);
  }

  function expectedOpenDays(fromLocal: Date, toLocal: Date) {
    let total = 0;
    let cursor = new Date(fromLocal);
    const end = new Date(toLocal);
    while (cursor <= end) {
      if (!closedPeriodForDay(cursor, holidayPeriods)) {
        const wd = getWeekday(cursor);
        total += slotsByWeekday.get(wd) || 0;
      }
      cursor = addDays(cursor, 1);
    }
    return total;
  }

  const expectedWeek = expectedOpenDays(
    weekStartLocal,
    new Date(parts.year, parts.month - 1, parts.day, 12, 0, 0),
  );
  const doneWeek = weekSessions.length;
  const fillRateWeek = pct(doneWeek, expectedWeek);

  const expectedMonth = expectedOpenDays(
    new Date(parts.year, parts.month - 1, 1, 12, 0, 0),
    new Date(parts.year, parts.month - 1, parts.day, 12, 0, 0),
  );  const doneMonth = monthSessions.length;
  const fillRateMonth = pct(doneMonth, expectedMonth);

  const byTeacherMap = new Map<
    string,
    { teacherId: string; name: string; done: number; missing: number }
  >();
  for (const s of activeSlotsToday) {
    const key = s.teacherId;
    const cur = byTeacherMap.get(key) || {
      teacherId: key,
      name: `${s.teacher.firstName} ${s.teacher.lastName}`,
      done: 0,
      missing: 0,
    };
    if (filledSlotIds.has(s.id)) cur.done += 1;
    else cur.missing += 1;
    byTeacherMap.set(key, cur);
  }

  const byClassroomMap = new Map<
    string,
    { classroomId: string; name: string; done: number; missing: number }
  >();
  for (const s of activeSlotsToday) {    const key = s.classroomId;
    const cur = byClassroomMap.get(key) || {
      classroomId: key,
      name: s.classroom.name,
      done: 0,
      missing: 0,
    };
    if (filledSlotIds.has(s.id)) cur.done += 1;
    else cur.missing += 1;
    byClassroomMap.set(key, cur);
  }

  const byTeacher = Array.from(byTeacherMap.values()).sort(
    (a, b) => b.missing - a.missing || a.name.localeCompare(b.name, "fr"),
  );
  const byClassroom = Array.from(byClassroomMap.values()).sort(
    (a, b) => b.missing - a.missing || a.name.localeCompare(b.name, "fr"),
  );

  return NextResponse.json({
    school: school
      ? { id: school.id, name: school.name, city: school.city }
      : null,
    adminName: admin ? `${admin.firstName} ${admin.lastName}` : "",
    today: {
      sessionsDone: done,
      sessionsMissing: missing.length,
      overdueMissing: overdueMissing.length,
      upcomingMissing: upcomingMissing.length,
      expected: expected,
      fillRatePercent: fillRate,
      validated: validatedToday,
      draft: draftToday,
      closed: !!todayClosed,
      closedReason: todayClosed
        ? todayClosed.kind === "strike"
          ? `Jour de grève : ${todayClosed.name}`
          : `Vacances : ${todayClosed.name}`
        : null,
    },    week: {
      sessionsDone: doneWeek,
      expected: expectedWeek,
      fillRatePercent: fillRateWeek,
    },
    month: {
      sessionsDone: doneMonth,
      expected: expectedMonth,
      fillRatePercent: fillRateMonth,
    },
    stock: {
      teachers: teachersCount,
      classrooms: classroomsCount,
      roomsActive: roomsActiveCount,
      subjects: subjectsCount,
    },
    // Compat anciennes clés (au cas où)
    sessionsDoneToday: done,
    sessionsMissingToday: missing.length,
    expectedToday: expected,
    fillRatePercent: fillRate,
    byTeacher,
    byClassroom,
    recentSessions: sessionsToday.slice(0, 8).map((s) => ({
      id: s.id,
      title: s.title || "(sans titre)",
      status: s.status,
      classroom: s.classroom.name,
      subject: s.subject.name,
      teacher: `${s.teacher.firstName} ${s.teacher.lastName}`,
      updatedAt: s.updatedAt,
    })),
    missingSlots: missing.slice(0, 20).map((s) => ({
      id: s.id,
      startsAt: s.startsAt,
      endsAt: s.endsAt,
      classroom: s.classroom.name,
      subject: s.subject.name,
      teacher: `${s.teacher.firstName} ${s.teacher.lastName}`,
      overdue: s.endsAt <= nowHm,
    })),
  });
}
