import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { addDays, formatWeekRange, startOfWeekMonday } from "@/lib/calendar";
import {
  formatDateLongFr,
  formatDateShortFr,
  formatHmFr,
  startOfDayGabon,
  zonedParts,
} from "@/lib/datetime";

const PERIODS = ["day", "week", "month", "year"] as const;
type Period = (typeof PERIODS)[number];

function parsePeriod(value: string | null): Period {
  return PERIODS.includes(value as Period) ? (value as Period) : "week";
}

function parseDayLocal(dateStr: string | null, now: Date) {
  if (dateStr && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    const [y, m, d] = dateStr.split("-").map(Number);
    return new Date(y, m - 1, d, 12, 0, 0);
  }
  const parts = zonedParts(now);
  return new Date(parts.year, parts.month - 1, parts.day, 12, 0, 0);
}

function toInputDate(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function hmFromDate(date: Date) {
  const hm = date.toLocaleTimeString("en-GB", {
    timeZone: "Africa/Libreville",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  return formatHmFr(hm);
}

function getPeriodBounds(
  period: Period,
  now: Date,
  dayDateStr: string | null,
) {
  const parts = zonedParts(now);
  const localToday = new Date(parts.year, parts.month - 1, parts.day, 12, 0, 0);

  if (period === "day") {
    const dayLocal = parseDayLocal(dayDateStr, now);
    return {
      period,
      title: "Jour",
      rangeLabel: formatDateLongFr(dayLocal),
      day: toInputDate(dayLocal),
      start: startOfDayGabon(dayLocal),
      end: startOfDayGabon(dayLocal),
    };
  }

  if (period === "week") {
    const weekStartLocal = startOfWeekMonday(localToday);
    const weekEndLocal = addDays(weekStartLocal, 6);
    return {
      period,
      title: "Semaine en cours",
      rangeLabel: formatWeekRange(weekStartLocal, weekEndLocal),
      day: null as string | null,
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
      title: "Mois en cours",
      rangeLabel: monthName,
      day: null as string | null,
      start: startOfDayGabon(monthStartLocal),
      end: startOfDayGabon(localToday),
    };
  }

  const yearStartLocal = new Date(parts.year, 0, 1, 12, 0, 0);
  return {
    period,
    title: "Année en cours",
    rangeLabel: String(parts.year),
    day: null as string | null,
    start: startOfDayGabon(yearStartLocal),
    end: startOfDayGabon(localToday),
  };
}

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (
    !session?.schoolId ||
    !["school_admin", "national_admin"].includes(session.role)
  ) {
    return NextResponse.json({ message: "Accès refusé" }, { status: 403 });
  }

  const classroomId = request.nextUrl.searchParams.get("classroomId");
  if (!classroomId) {
    return NextResponse.json({ message: "Classe requise" }, { status: 400 });
  }

  const period = parsePeriod(request.nextUrl.searchParams.get("period"));
  const bounds = getPeriodBounds(
    period,
    new Date(),
    request.nextUrl.searchParams.get("date"),
  );

  const classroom = await prisma.classroom.findFirst({
    where: {
      id: classroomId,
      schoolId: session.schoolId,
      deletedAt: null,
    },
    include: {
      school: { select: { name: true, city: true } },
      schoolYear: { select: { label: true } },
    },
  });
  if (!classroom) {
    return NextResponse.json({ message: "Classe introuvable" }, { status: 404 });
  }

  const [sessions, students] = await Promise.all([
    prisma.lessonSession.findMany({
      where: {
        classroomId,
        schoolId: session.schoolId,
        deletedAt: null,
        sessionDate: { gte: bounds.start, lte: bounds.end },
      },
      select: {
        id: true,
        sessionDate: true,
        startsAt: true,
        endsAt: true,
        subject: { select: { name: true } },
      },
      orderBy: [{ sessionDate: "asc" }, { startsAt: "asc" }],
    }),
    prisma.student.findMany({
      where: {
        classroomId,
        schoolId: session.schoolId,
        isActive: true,
        deletedAt: null,
      },
      select: { id: true, firstName: true, lastName: true },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    }),
  ]);

  const sessionIds = sessions.map((s) => s.id);
  const sessionCount = sessionIds.length;

  const records =
    sessionIds.length === 0
      ? []
      : await prisma.attendanceRecord.findMany({
          where: { sessionId: { in: sessionIds } },
          select: { sessionId: true, studentId: true, status: true },
        });

  const statusByStudentSession = new Map<string, string>();
  for (const r of records) {
    statusByStudentSession.set(`${r.studentId}:${r.sessionId}`, r.status);
  }

  function sessionLabel(lesson: (typeof sessions)[number]) {
    return `${formatDateShortFr(lesson.sessionDate)} · ${lesson.subject.name} (${hmFromDate(lesson.startsAt)})`;
  }

  const items = students.map((student) => {
    let present = 0;
    let absent = 0;
    let late = 0;
    const absentDates: string[] = [];
    const lateDates: string[] = [];
    for (const lesson of sessions) {
      const status =
        statusByStudentSession.get(`${student.id}:${lesson.id}`) || "present";
      if (status === "absent") {
        absent += 1;
        absentDates.push(sessionLabel(lesson));
      } else if (status === "late") {
        late += 1;
        lateDates.push(sessionLabel(lesson));
      } else {
        present += 1;
      }
    }
    return {
      studentId: student.id,
      lastName: student.lastName,
      firstName: student.firstName,
      present,
      absent,
      late,
      sessions: sessionCount,
      absentDates,
      lateDates,
    };
  });

  const dayRows =
    period === "day"
      ? sessions.flatMap((lesson) => {
          const timeRange = `${hmFromDate(lesson.startsAt)} – ${hmFromDate(lesson.endsAt)}`;
          return students.map((student) => {
            const status =
              statusByStudentSession.get(`${student.id}:${lesson.id}`) ||
              "present";
            return {
              studentId: student.id,
              lastName: student.lastName,
              firstName: student.firstName,
              sessionId: lesson.id,
              subject: lesson.subject.name,
              timeRange,
              status: status as "present" | "absent" | "late",
            };
          });
        })
      : [];

  const totals = items.reduce(
    (acc, row) => {
      acc.present += row.present;
      acc.absent += row.absent;
      acc.late += row.late;
      return acc;
    },
    { present: 0, absent: 0, late: 0 },
  );

  return NextResponse.json({
    period: bounds.period,
    periodTitle: bounds.title,
    rangeLabel: bounds.rangeLabel,
    day: bounds.day,
    classroom: {
      id: classroom.id,
      name: classroom.name,
      schoolName: classroom.school.name,
      schoolCity: classroom.school.city,
      schoolYear: classroom.schoolYear.label,
    },
    sessionCount,
    studentCount: students.length,
    totals,
    items,
    dayRows,
    generatedAt: new Date().toISOString(),
  });
}
