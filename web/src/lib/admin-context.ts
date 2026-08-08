import { prisma } from "@/lib/prisma";
import { getSession, type SessionPayload } from "@/lib/auth";

export type AdminSchoolContext = {
  session: SessionPayload;
  userId: string;
  schoolId: string;
  role: string;
};

/**
 * Résout l’admin école depuis la BDD (pas seulement le JWT),
 * pour survivre à un seed / reset qui invalide schoolId en cookie.
 */
export async function resolveSchoolAdmin(): Promise<
  | { ok: true; ctx: AdminSchoolContext }
  | { ok: false; status: number; message: string; code?: string }
> {
  const session = await getSession();
  if (!session) {
    return {
      ok: false,
      status: 401,
      message: "Non authentifié. Reconnectez-vous.",
      code: "NO_SESSION",
    };
  }

  if (session.role === "national_admin") {
    return {
      ok: false,
      status: 403,
      message: "Réservé à la direction d’établissement.",
      code: "WRONG_ROLE",
    };
  }

  if (session.role !== "school_admin") {
    return {
      ok: false,
      status: 403,
      message: "Accès réservé à l’espace Admin direction.",
      code: "WRONG_ROLE",
    };
  }

  const user = await prisma.user.findFirst({
    where: {
      id: session.sub,
      role: "school_admin",
      isActive: true,
      deletedAt: null,
    },
    select: { id: true, schoolId: true, role: true },
  });

  if (!user) {
    return {
      ok: false,
      status: 401,
      message:
        "Compte introuvable (base réinitialisée ?). Déconnectez-vous puis reconnectez-vous avec admin@lycee.ga / admin123.",
      code: "USER_NOT_FOUND",
    };
  }

  if (!user.schoolId) {
    return {
      ok: false,
      status: 401,
      message: "Aucun établissement lié à ce compte.",
      code: "NO_SCHOOL",
    };
  }

  const school = await prisma.school.findUnique({
    where: { id: user.schoolId },
    select: { id: true },
  });

  if (!school) {
    return {
      ok: false,
      status: 401,
      message:
        "Établissement introuvable. Déconnectez-vous puis reconnectez-vous.",
      code: "SCHOOL_NOT_FOUND",
    };
  }

  return {
    ok: true,
    ctx: {
      session,
      userId: user.id,
      schoolId: user.schoolId,
      role: user.role,
    },
  };
}
