import type { SessionPayload } from "@/lib/auth";

export function isDemoUiEnabled() {
  return process.env.NODE_ENV !== "production";
}

const PIN_MAX_ATTEMPTS = 5;
const PIN_LOCK_MINUTES = 15;

export function pinLockUntilFromAttempts(attempts: number): Date | null {
  if (attempts < PIN_MAX_ATTEMPTS) return null;
  return new Date(Date.now() + PIN_LOCK_MINUTES * 60 * 1000);
}

export { PIN_MAX_ATTEMPTS, PIN_LOCK_MINUTES };

type LessonAccess = {
  id: string;
  schoolId: string;
  teacherId: string;
  roomId: string;
};

/** Accès lecture/écriture d’une séance selon le rôle. */
export function canAccessLesson(
  session: SessionPayload,
  lesson: LessonAccess,
  mode: "read" | "write" = "read",
): boolean {
  if (session.role === "national_admin") {
    return mode === "read";
  }

  if (session.role === "school_admin") {
    return !!session.schoolId && session.schoolId === lesson.schoolId;
  }

  if (session.scope === "room") {
    if (session.sub !== lesson.teacherId) return false;
    if (mode === "write") {
      return session.sessionId === lesson.id;
    }
    // Lecture : historique cahier de la même salle
    return !!session.roomId && session.roomId === lesson.roomId;
  }

  if (session.role === "teacher") {
    return session.sub === lesson.teacherId;
  }

  return false;
}

export function canValidateLesson(
  session: SessionPayload,
  lesson: LessonAccess,
): boolean {
  if (session.role === "national_admin") return false;
  if (session.role === "school_admin") {
    return !!session.schoolId && session.schoolId === lesson.schoolId;
  }
  if (session.scope === "room") {
    return session.sessionId === lesson.id && session.sub === lesson.teacherId;
  }
  if (session.role === "teacher") {
    return session.sub === lesson.teacherId;
  }
  return false;
}

/** Hub / présence / historique après PIN salle. */
export function canAccessRoomHub(
  session: SessionPayload,
  lesson: LessonAccess,
): boolean {
  if (session.scope === "room") {
    return (
      session.sessionId === lesson.id &&
      session.sub === lesson.teacherId &&
      session.roomId === lesson.roomId
    );
  }
  if (session.role === "school_admin") {
    return !!session.schoolId && session.schoolId === lesson.schoolId;
  }
  if (session.role === "teacher") {
    return session.sub === lesson.teacherId;
  }
  return false;
}
