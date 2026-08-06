import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { addDays, formatWeekRange, startOfWeekMonday } from "@/lib/calendar";
import {
  formatDateShortFr,
  formatDateTimeFr,
  formatHmFr,
  startOfDayGabon,
  zonedParts,
} from "@/lib/datetime";

const PERIODS = ["week", "month", "year"] as const;
type Period = (typeof PERIODS)[number];

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
      title: "Semaine en cours",
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
      title: "Mois en cours",
      rangeLabel: monthName,
      start: startOfDayGabon(monthStartLocal),
      end: startOfDayGabon(localToday),
    };
  }

  const yearStartLocal = new Date(parts.year, 0, 1, 12, 0, 0);
  return {
    period,
    title: "Année en cours",
    rangeLabel: String(parts.year),
    start: startOfDayGabon(yearStartLocal),
    end: startOfDayGabon(localToday),
  };
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

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session?.schoolId || !["school_admin", "national_admin"].includes(session.role)) {
    return NextResponse.json({ message: "Accès refusé" }, { status: 403 });
  }

  const classroomId = request.nextUrl.searchParams.get("classroomId");
  if (!classroomId) {
    return NextResponse.json({ message: "Classe requise" }, { status: 400 });
  }

  const period = parsePeriod(request.nextUrl.searchParams.get("period"));
  const bounds = getPeriodBounds(period, new Date());

  const classroom = await prisma.classroom.findFirst({
    where: { id: classroomId, schoolId: session.schoolId, deletedAt: null },
    include: { school: true, schoolYear: true },
  });
  if (!classroom) {
    return NextResponse.json({ message: "Classe introuvable" }, { status: 404 });
  }

  const sessions = await prisma.lessonSession.findMany({
    where: {
      classroomId,
      schoolId: session.schoolId,
      deletedAt: null,
      sessionDate: { gte: bounds.start, lte: bounds.end },
    },
    include: { subject: true, teacher: true, room: true },
    orderBy: [{ sessionDate: "asc" }, { startsAt: "asc" }],
  });

  return NextResponse.json({
    period: bounds.period,
    periodTitle: bounds.title,
    rangeLabel: bounds.rangeLabel,
    classroom: {
      id: classroom.id,
      name: classroom.name,
      schoolName: classroom.school.name,
      schoolCity: classroom.school.city,
      schoolYear: classroom.schoolYear.label,
    },
    sessions: sessions.map((s) => ({
      id: s.id,
      date: formatDateShortFr(s.sessionDate),
      timeRange: `${hmFromDate(s.startsAt)} – ${hmFromDate(s.endsAt)}`,
      subject: s.subject.name,
      teacher: `${s.teacher.firstName} ${s.teacher.lastName}`,
      room: s.room.label,
      status: s.status,
      title: s.title || "(sans titre)",
      content: s.content,
      exercises: s.exercises,
      homeworkText: s.homeworkText,
      homeworkDueOn: s.homeworkDueOn ? formatDateShortFr(s.homeworkDueOn) : null,
      observations: s.observations,
      signatureImage: s.signatureImage,
      validatedAt: s.validatedAt ? formatDateTimeFr(s.validatedAt) : null,
    })),
    generatedAt: new Date().toISOString(),
  });
}
