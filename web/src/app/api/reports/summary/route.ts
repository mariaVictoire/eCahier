import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { addDays, formatWeekRange, startOfWeekMonday } from "@/lib/calendar";
import { formatDateLongFr, formatDateShortFr, getWeekdayGabon, startOfDayGabon, zonedParts } from "@/lib/datetime";

const PERIODS = ["week", "month", "year"] as const;

type Period = (typeof PERIODS)[number];

function pct(done: number, expected: number) {
  if (expected === 0) return 100;
  return Math.round((done / expected) * 1000) / 10;
}

function toDateKey(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function parsePeriod(value: string | null): Period {
  return PERIODS.includes(value as Period) ? (value as Period) : "week";
}

function getPeriodBounds(period: Period, now: Date) {
  const parts = zonedParts(now);
  const localToday = new Date(parts.year, parts.month - 1, parts.day, 12, 0, 0);

  if (period === "week") {
    const weekStartLocal = startOfWeekMonday(localToday);
    const weekEndLocal = addDays(weekStartLocal, 6);
    return {
      period,
      title: "Rapport hebdomadaire",
      rangeLabel: formatWeekRange(weekStartLocal, weekEndLocal),
      start: startOfDayGabon(weekStartLocal),
      end: startOfDayGabon(localToday),
    };
  }

  if (period === "month") {
    const monthStartLocal = new Date(parts.year, parts.month - 1, 1, 12, 0, 0);
    const monthName = localToday.toLocaleDateString("fr-FR", {
      month: "long",
      year: "numeric",
    });
    return {
      period,
      title: "Rapport mensuel",
      rangeLabel: monthName,
      start: startOfDayGabon(monthStartLocal),
      end: startOfDayGabon(localToday),
    };
  }

  const yearStartLocal = new Date(parts.year, 0, 1, 12, 0, 0);
  return {
    period,
    title: "Rapport annuel",
    rangeLabel: String(parts.year),
    start: startOfDayGabon(yearStartLocal),
    end: startOfDayGabon(localToday),
  };
}

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session?.schoolId || !["school_admin", "national_admin"].includes(session.role)) {
    return NextResponse.json({ message: "Accès refusé" }, { status: 403 });
  }

  const period = parsePeriod(request.nextUrl.searchParams.get("period"));
  const now = new Date();
  const bounds = getPeriodBounds(period, now);
  const schoolId = session.schoolId;

  const [school, admin, slots, sessions] = await Promise.all([
    prisma.school.findUnique({ where: { id: schoolId } }),
    prisma.user.findUnique({ where: { id: session.sub } }),
    prisma.timetableSlot.findMany({
      where: {
        schoolId,
        deletedAt: null,
        effectiveFrom: { lte: bounds.end },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: bounds.start } }],
      },
      include: {
        teacher: true,
        classroom: true,
        subject: true,
      },
      orderBy: [{ weekday: "asc" }, { startsAt: "asc" }],
    }),
    prisma.lessonSession.findMany({
      where: {
        schoolId,
        deletedAt: null,
        sessionDate: { gte: bounds.start, lte: bounds.end },
      },
      include: {
        teacher: true,
        classroom: true,
        subject: true,
      },
      orderBy: { updatedAt: "desc" },
    }),
  ]);

  const sessionsBySlotAndDay = new Map<string, (typeof sessions)[number]>();
  for (const sessionItem of sessions) {
    if (!sessionItem.slotId) continue;
    sessionsBySlotAndDay.set(
      `${sessionItem.slotId}:${formatDateShortFr(sessionItem.sessionDate)}`,
      sessionItem,
    );
  }

  const slotsByWeekday = new Map<string, typeof slots>();
  for (const slot of slots) {
    const list = slotsByWeekday.get(slot.weekday) || [];
    list.push(slot);
    slotsByWeekday.set(slot.weekday, list);
  }

  const byTeacherMap = new Map<
    string,
    { teacherId: string; name: string; done: number; missing: number }
  >();
  const byClassroomMap = new Map<
    string,
    { classroomId: string; name: string; done: number; missing: number }
  >();
  const missingOccurrences: {
    id: string;
    date: string;
    startsAt: string;
    endsAt: string;
    classroom: string;
    subject: string;
    teacher: string;
  }[] = [];

  let expected = 0;
  let cursor = new Date(bounds.start);
  while (cursor <= bounds.end) {
    const weekday = getWeekdayGabon(cursor);
    const daySlots = (slotsByWeekday.get(weekday) || []).filter((slot) => {
      if (slot.effectiveFrom > cursor) return false;
      if (slot.effectiveTo && slot.effectiveTo < cursor) return false;
      return true;
    });

    for (const slot of daySlots) {
      expected += 1;
      const dateKey = formatDateShortFr(cursor);
      const sessionItem = sessionsBySlotAndDay.get(`${slot.id}:${dateKey}`);

      const teacherRow = byTeacherMap.get(slot.teacherId) || {
        teacherId: slot.teacherId,
        name: `${slot.teacher.firstName} ${slot.teacher.lastName}`,
        done: 0,
        missing: 0,
      };
      const classroomRow = byClassroomMap.get(slot.classroomId) || {
        classroomId: slot.classroomId,
        name: slot.classroom.name,
        done: 0,
        missing: 0,
      };

      if (sessionItem) {
        teacherRow.done += 1;
        classroomRow.done += 1;
      } else {
        teacherRow.missing += 1;
        classroomRow.missing += 1;
        missingOccurrences.push({
          id: `${slot.id}:${toDateKey(cursor)}`,
          date: formatDateLongFr(cursor),
          startsAt: slot.startsAt,
          endsAt: slot.endsAt,
          classroom: slot.classroom.name,
          subject: slot.subject.name,
          teacher: `${slot.teacher.firstName} ${slot.teacher.lastName}`,
        });
      }

      byTeacherMap.set(slot.teacherId, teacherRow);
      byClassroomMap.set(slot.classroomId, classroomRow);
    }

    cursor = addDays(cursor, 1);
  }

  const done = sessions.length;
  const validated = sessions.filter((item) => item.status === "validated").length;
  const draft = sessions.filter((item) => item.status === "draft").length;

  const byTeacher = Array.from(byTeacherMap.values()).sort(
    (a, b) => b.missing - a.missing || a.name.localeCompare(b.name, "fr"),
  );
  const byClassroom = Array.from(byClassroomMap.values()).sort(
    (a, b) => b.missing - a.missing || a.name.localeCompare(b.name, "fr"),
  );

  return NextResponse.json({
    period: bounds.period,
    title: bounds.title,
    rangeLabel: bounds.rangeLabel,
    generatedAt: now.toISOString(),
    school: school
      ? { id: school.id, name: school.name, city: school.city }
      : null,
    adminName: admin ? `${admin.firstName} ${admin.lastName}` : "",
    metrics: {
      expected,
      done,
      missing: Math.max(0, expected - done),
      validated,
      draft,
      fillRatePercent: pct(done, expected),
    },
    byTeacher,
    byClassroom,
    recentSessions: sessions.slice(0, 10).map((item) => ({
      id: item.id,
      date: formatDateShortFr(item.sessionDate),
      classroom: item.classroom.name,
      subject: item.subject.name,
      teacher: `${item.teacher.firstName} ${item.teacher.lastName}`,
      status: item.status,
      title: item.title || "(sans titre)",
    })),
    missingSlots: missingOccurrences.slice(0, 12),
  });
}
