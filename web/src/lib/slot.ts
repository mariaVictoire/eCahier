import { prisma } from "./prisma";
import {
  combineDateAndTimeGabon,
  formatHmGabon,
  getWeekdayGabon,
  startOfDayGabon,
} from "./datetime";
import { isClosedSchoolDay } from "./holidays";
import { shortDisplayName } from "./person-name";

/** Nombre max de cours non saisis proposés hors créneau exact. */
export const CATCHUP_MAX = 2;

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

function toMin(hm: string) {
  const [h, m] = hm.split(":").map(Number);
  return h * 60 + m;
}

export async function resolveCurrentSlot(roomPublicId: string, at = new Date()) {
  const key = roomPublicId.trim();
  if (!key) {
    return { room: null, school: null, slot: null, candidates: [] as never[] };
  }

  const room = await prisma.room.findFirst({
    where: {
      isActive: true,
      deletedAt: null,
      OR: [
        { publicId: key },
        { code: { equals: key, mode: "insensitive" } },
      ],
    },
    include: { school: true },
  });
  if (!room) return { room: null, school: null, slot: null, candidates: [] as never[] };

  const schoolInfo = {
    id: room.school.id,
    name: room.school.name,
    city: room.school.city,
  };

  const roomInfo = {
    id: room.id,
    code: room.code,
    label: room.label,
    publicId: room.publicId,
  };

  const closed = await isClosedSchoolDay(at);
  if (closed.closed) {
    return {
      room: roomInfo,
      school: schoolInfo,
      slot: null,
      candidates: [] as never[],
      resolvedAt: at.toISOString(),
      note: closed.reason,
    };
  }

  const weekday = getWeekday(at);
  const nowHm = formatTime(at);
  const dayStart = startOfDayGabon(at);

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

  const sessionsToday = await prisma.lessonSession.findMany({
    where: {
      roomId: room.id,
      sessionDate: dayStart,
      deletedAt: null,
    },
    select: { slotId: true },
  });
  const openedSlotIds = new Set(
    sessionsToday.map((s) => s.slotId).filter((id): id is string => !!id),
  );

  const mapSlot = (s: (typeof slots)[number], catchUp = false) => ({
    id: s.id,
    startsAt: s.startsAt,
    endsAt: s.endsAt,
    classroom: { id: s.classroom.id, name: s.classroom.name },
    subject: { id: s.subject.id, name: s.subject.name },
    expectedTeacher: {
      id: s.teacher.id,
      displayName: shortDisplayName(s.teacher),
    },
    schoolId: s.schoolId,
    schoolYearId: s.schoolYearId,
    roomId: s.roomId,
    classroomId: s.classroomId,
    subjectId: s.subjectId,
    teacherId: s.teacherId,
    catchUp,
    alreadyOpened: openedSlotIds.has(s.id),
  });

  const matching = slots.filter((s) =>
    isInWindow(nowHm, s.startsAt, s.endsAt),
  );

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
      candidates: matching.map((s) => mapSlot(s)),
      resolvedAt: at.toISOString(),
      note: "Plusieurs créneaux en cours — choisissez le vôtre.",
    };
  }

  // Hors créneau : proposer jusqu’à CATCHUP_MAX cours déjà terminés et non saisis.
  const nowMin = toMin(nowHm);
  const catchUpSlots = slots
    .filter((s) => toMin(s.endsAt) < nowMin)
    .filter((s) => !openedSlotIds.has(s.id))
    .sort((a, b) => toMin(b.endsAt) - toMin(a.endsAt))
    .slice(0, CATCHUP_MAX);

  if (catchUpSlots.length > 0) {
    const candidates = catchUpSlots.map((s) => mapSlot(s, true));
    return {
      room: roomInfo,
      school: schoolInfo,
      slot: candidates[0],
      candidates,
      resolvedAt: at.toISOString(),
    };
  }

  // Rien à rattraper : indiquer le prochain créneau du jour s’il existe.
  const upcoming = slots.filter((s) => toMin(s.startsAt) > nowMin);
  if (upcoming.length > 0) {
    const next = mapSlot(upcoming[0]);
    return {
      room: roomInfo,
      school: schoolInfo,
      slot: next,
      candidates: [next],
      resolvedAt: at.toISOString(),
      note: "Aucun cours à rattraper. Prochain créneau affiché (pas encore commencé).",
    };
  }

  return {
    room: roomInfo,
    school: schoolInfo,
    slot: null,
    candidates: [] as ReturnType<typeof mapSlot>[],
    resolvedAt: at.toISOString(),
    note: "Aucun créneau à saisir pour cette salle aujourd’hui.",
  };
}

export function startOfDay(date: Date) {
  return startOfDayGabon(date);
}

export function combineDateAndTime(date: Date, hm: string) {
  return combineDateAndTimeGabon(date, hm);
}
