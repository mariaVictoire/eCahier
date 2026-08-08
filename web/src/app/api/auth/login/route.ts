import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  audit,
  setSessionCookie,
  signSession,
} from "@/lib/auth";
import bcrypt from "bcryptjs";

export async function POST(req: Request) {
  const body = await req.json();
  const email = String(body.email || "").trim().toLowerCase();
  const password = String(body.password || "");

  const user = await prisma.user.findFirst({
    where: { email, deletedAt: null, isActive: true },
  });

  if (!user) {
    return NextResponse.json({ message: "Identifiants incorrects" }, { status: 401 });
  }

  if (user.role === "teacher") {
    return NextResponse.json(
      {
        message:
          "Accès réservé à l’espace Admin. Les enseignants scannent le QR de la salle.",
      },
      { status: 403 },
    );
  }

  let ok = false;
  if (password && user.passwordHash) {
    ok = await bcrypt.compare(password, user.passwordHash);
  }

  if (!ok) {
    await audit("login.fail", {
      schoolId: user.schoolId,
      actorId: user.id,
      entityType: "user",
      entityId: user.id,
    });
    return NextResponse.json({ message: "Identifiants incorrects" }, { status: 401 });
  }

  if (user.role === "school_admin" && user.schoolId) {
    const school = await prisma.school.findUnique({
      where: { id: user.schoolId },
      select: { id: true },
    });
    if (!school) {
      return NextResponse.json(
        {
          message:
            "Établissement lié au compte introuvable. Relancez le seed ou contactez le support.",
        },
        { status: 500 },
      );
    }
  }

  const token = await signSession({
    sub: user.id,
    role: user.role,
    schoolId: user.schoolId,
    firstName: user.firstName,
    lastName: user.lastName,
    scope: "admin",
  });
  await setSessionCookie(token);
  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });
  await audit("login.ok", {
    schoolId: user.schoolId,
    actorId: user.id,
    entityType: "user",
    entityId: user.id,
  });

  return NextResponse.json({
    user: {
      id: user.id,
      role: user.role,
      schoolId: user.schoolId,
      firstName: user.firstName,
      lastName: user.lastName,
    },
  });
}
