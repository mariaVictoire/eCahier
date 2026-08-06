import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  audit,
  setSessionCookie,
  signSession,
  verifyPin,
} from "@/lib/auth";
import bcrypt from "bcryptjs";

export async function POST(req: Request) {
  const body = await req.json();
  const email = String(body.email || "").trim().toLowerCase();
  const password = String(body.password || "");
  const pin = String(body.pin || "");

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
  } else if (pin) {
    ok = await verifyPin(pin, user.pinHash);
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

  const token = await signSession({
    sub: user.id,
    role: user.role,
    schoolId: user.schoolId,
    firstName: user.firstName,
    lastName: user.lastName,
    scope: user.role === "teacher" ? "admin" : "admin",
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
      firstName: user.firstName,
      lastName: user.lastName,
    },
  });
}
