import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";

const COOKIE = "ecahier_session";
const DEV_FALLBACK = "ecahier-dev-secret-change-me";

export type SessionPayload = {
  sub: string;
  role: string;
  schoolId: string | null;
  firstName: string;
  lastName: string;
  /** Scoped room session fields */
  slotId?: string;
  roomId?: string;
  sessionId?: string;
  scope?: "admin" | "room";
};

function secret() {
  const value = process.env.AUTH_SECRET?.trim();
  if (process.env.NODE_ENV === "production") {
    if (!value || value === DEV_FALLBACK || value.length < 32) {
      throw new Error(
        "AUTH_SECRET manquant ou trop faible (min. 32 caractères) en production.",
      );
    }
  }
  return new TextEncoder().encode(value || DEV_FALLBACK);
}

export async function signSession(
  payload: SessionPayload,
  expiresIn = "8h",
) {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(secret());
}

export async function verifySession(token: string) {
  const { payload } = await jwtVerify(token, secret());
  return payload as unknown as SessionPayload;
}

export async function setSessionCookie(token: string) {
  const jar = await cookies();
  jar.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 8,
  });
}

export async function clearSessionCookie() {
  const jar = await cookies();
  jar.delete(COOKIE);
}

export async function getSession(): Promise<SessionPayload | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;
  try {
    return await verifySession(token);
  } catch {
    return null;
  }
}

export async function requireSession(roles?: string[]) {
  const session = await getSession();
  if (!session) return null;
  if (roles && !roles.includes(session.role)) return null;
  return session;
}

export async function hashPin(pin: string) {
  return bcrypt.hash(pin, 10);
}

export async function verifyPin(pin: string, hash: string | null) {
  if (!hash) return false;
  return bcrypt.compare(pin, hash);
}

export async function audit(
  action: string,
  opts: {
    schoolId?: string | null;
    actorId?: string | null;
    entityType: string;
    entityId?: string;
    meta?: Record<string, unknown>;
  },
) {
  await prisma.auditLog.create({
    data: {
      action,
      schoolId: opts.schoolId ?? null,
      actorId: opts.actorId ?? null,
      entityType: opts.entityType,
      entityId: opts.entityId,
      meta: JSON.stringify(opts.meta ?? {}),
    },
  });
}

export {
  shortDisplayName,
  shortDisplayName as displayName,
  fullDisplayName,
} from "./person-name";
