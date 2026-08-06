import { prisma } from "./prisma";
import {
  combineDateAndTimeGabon,
  formatHmGabon,
  getWeekdayGabon,
  startOfDayGabon,
} from "./datetime";

export function getWeekday(date: Date) {
  return getWeekdayGabon(date);
}

export function formatTime(date: Date) {
  return formatHmGabon(date);
}

/** Returns true if `now` HH:mm is within [start, end] with ±toleranceMin. */
export function isInWindow(
  nowHm: string,
  startsAt: string,
  endsAt: string,
  toleranceMin = 20,
) {
  const toMin = (hm: string) => {
    const [h, m] = hm.split(":").map(Number);
    return h * 60 + m;
  };
  const now = toMin(nowHm);
  const start = toMin(startsAt) - toleranceMin;
  const end = toMin(endsAt) + toleranceMin;
  return now >= start && now <= end;
}

export async function resolveCurrentSlot(roomPublicId: string, at = new Date()) {
  const room = await prisma.room.findFirst({
    where: { publicId: roomPublicId, isActive: true, deletedAt: null },
    include: { school: true },
  });
  if (!room) return { room: null, school: null, slot: null, candidates: [] as never[] };

  const schoolInfo = {
    id: room.school.id,
    name: room.school.name,
    city: room.school.city,
  };

  const weekday = getWeekday(at);
  const nowHm = formatTime(at);

  const slots = await prisma.timetableSlot.findMany({
    where: {
      roomId: room.id,
      weekday,
      deletedAt: null,
      effectiveFrom: { lte: at },
      OR: [{ effectiveTo: null }, { effectiveTo: { gte: at } }],
    },
    include: {
      classroom: true,
      subject: true,
      teacher: true,
    },
    orderBy: { startsAt: "asc" },
  });

  const matching = slots.filter((s) =>
    isInWindow(nowHm, s.startsAt, s.endsAt),
  );

  const mapSlot = (s: (typeof slots)[number]) => ({
    id: s.id,
    startsAt: s.startsAt,
    endsAt: s.endsAt,
    classroom: { id: s.classroom.id, name: s.classroom.name },
    subject: { id: s.subject.id, name: s.subject.name },
    expectedTeacher: {
      id: s.teacher.id,
      displayName: `${s.teacher.firstName} ${s.teacher.lastName}`,
    },
    schoolId: s.schoolId,
    schoolYearId: s.schoolYearId,
    roomId: s.roomId,
    classroomId: s.classroomId,
    subjectId: s.subjectId,
    teacherId: s.teacherId,
  });

  const roomInfo = {
    id: room.id,
    code: room.code,
    label: room.label,
    publicId: room.publicId,
  };

  if (matching.length === 1) {
    return {
      room: roomInfo,
      school: schoolInfo,
      slot: mapSlot(matching[0]),
      candidates: [] as ReturnType<typeof mapSlot>[],
      resolvedAt: at.toISOString(),
    };
  }

  if (matching.length > 1) {
    return {
      room: roomInfo,
      school: schoolInfo,
      slot: null,
      candidates: matching.map(mapSlot),
      resolvedAt: at.toISOString(),
    };
  }

  // Fallback: nearest upcoming / recent slot today
  const candidates = slots.map(mapSlot);
  return {
    room: roomInfo,
    school: schoolInfo,
    slot: candidates[0] ?? null,
    candidates,
    resolvedAt: at.toISOString(),
    note:
      matching.length === 0
        ? "Aucun créneau exact — créneau le plus proche proposé."
        : undefined,
  };
}

export function combineDateAndTime(date: Date, hm: string) {
  return combineDateAndTimeGabon(date, hm);
}

export function startOfDay(date: Date) {
  return startOfDayGabon(date);
}
