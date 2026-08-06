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

const WEEKDAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;

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

  const weekdayIdx = WEEKDAYS.indexOf(weekday as (typeof WEEKDAYS)[number]);
  const weekdaysToDate =
    weekdayIdx >= 0 ? WEEKDAYS.slice(0, weekdayIdx + 1) : ["mon"];

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
  ]);

  const filledSlotIds = new Set(
    sessionsToday.filter((s) => s.slotId).map((s) => s.slotId as string),
  );

  const missing = slotsToday.filter((s) => !filledSlotIds.has(s.id));
  const overdueMissing = missing.filter((s) => s.endsAt <= nowHm);
  const upcomingMissing = missing.filter((s) => s.endsAt > nowHm);

  const done = sessionsToday.length;
  const expected = slotsToday.length;
  const fillRate = pct(done, expected);
  const validatedToday = sessionsToday.filter((s) => s.status === "validated").length;
  const draftToday = sessionsToday.filter((s) => s.status === "draft").length;

  const slotsByWeekday = new Map<string, number>();
  for (const s of allSlots) {
    slotsByWeekday.set(s.weekday, (slotsByWeekday.get(s.weekday) || 0) + 1);
  }

  let expectedWeek = 0;
  for (const d of weekdaysToDate) {
    expectedWeek += slotsByWeekday.get(d) || 0;
  }
  const doneWeek = weekSessions.length;
  const fillRateWeek = pct(doneWeek, expectedWeek);

  // Mois : estimation = créneaux/jour ouvr × jours ouvr écoulés (lun–sam typiquement)
  const schoolDaysInMonth: string[] = [];
  {
    let cursor = new Date(parts.year, parts.month - 1, 1, 12, 0, 0);
    const end = new Date(parts.year, parts.month - 1, parts.day, 12, 0, 0);
    while (cursor <= end) {
      const wd = getWeekday(cursor);
      if ((slotsByWeekday.get(wd) || 0) > 0) {
        schoolDaysInMonth.push(wd);
      }
      cursor = addDays(cursor, 1);
    }
  }
  let expectedMonth = 0;
  for (const d of schoolDaysInMonth) {
    expectedMonth += slotsByWeekday.get(d) || 0;
  }
  const doneMonth = monthSessions.length;
  const fillRateMonth = pct(doneMonth, expectedMonth);

  const byTeacherMap = new Map<
    string,
    { teacherId: string; name: string; done: number; missing: number }
  >();
  for (const s of slotsToday) {
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
  for (const s of slotsToday) {
    const key = s.classroomId;
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
    },
    week: {
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
