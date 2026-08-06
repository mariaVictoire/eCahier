import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { audit, getSession } from "@/lib/auth";
import { phoneDigits } from "@/lib/phone";

async function requireAdmin() {
  const session = await getSession();
  if (
    !session?.schoolId ||
    !["school_admin", "national_admin"].includes(session.role)
  ) {
    return null;
  }
  return session;
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ message: "Accès refusé" }, { status: 403 });
  }

  const { id } = await ctx.params;
  const existing = await prisma.user.findFirst({
    where: {
      id,
      schoolId: session.schoolId!,
      role: "teacher",
      deletedAt: null,
    },
  });
  if (!existing) {
    return NextResponse.json({ message: "Enseignant introuvable" }, { status: 404 });
  }

  const body = await req.json();
  const firstName =
    body.firstName !== undefined
      ? String(body.firstName).trim()
      : existing.firstName;
  const lastName =
    body.lastName !== undefined
      ? String(body.lastName).trim()
      : existing.lastName;
  const phone =
    body.phone !== undefined
      ? String(body.phone).trim()
      : existing.phone || "";
  const isActive =
    body.isActive !== undefined ? Boolean(body.isActive) : existing.isActive;
  const pin =
    body.pin !== undefined && body.pin !== ""
      ? String(body.pin).trim()
      : null;

  if (!firstName || !lastName) {
    return NextResponse.json(
      { message: "Prénom et nom obligatoires" },
      { status: 400 },
    );
  }
  if (!phone || phoneDigits(phone).length < 8) {
    return NextResponse.json(
      { message: "Numéro de téléphone obligatoire (WhatsApp)" },
      { status: 400 },
    );
  }
  if (pin && !/^\d{4,8}$/.test(pin)) {
    return NextResponse.json(
      { message: "PIN invalide : 4 à 8 chiffres" },
      { status: 400 },
    );
  }

  const phoneKey = phoneDigits(phone);
  const peers = await prisma.user.findMany({
    where: {
      schoolId: session.schoolId!,
      role: "teacher",
      deletedAt: null,
      phone: { not: null },
      NOT: { id },
    },
    select: { id: true, phone: true },
  });
  if (peers.some((p) => phoneDigits(p.phone || "") === phoneKey)) {
    return NextResponse.json(
      { message: "Un enseignant avec ce numéro existe déjà" },
      { status: 409 },
    );
  }

  const school = await prisma.school.findUnique({
    where: { id: session.schoolId! },
    select: { name: true },
  });

  const data: {
    firstName: string;
    lastName: string;
    phone: string;
    isActive: boolean;
    pinHash?: string;
    pinCode?: string;
    pinFailedAttempts?: number;
    pinLockedUntil?: null;
  } = {
    firstName,
    lastName,
    phone,
    isActive,
  };

  if (pin) {
    data.pinHash = await bcrypt.hash(pin, 10);
    data.pinCode = pin;
    data.pinFailedAttempts = 0;
    data.pinLockedUntil = null;
  }

  const teacher = await prisma.user.update({
    where: { id },
    data,
    select: {
      id: true,
      firstName: true,
      lastName: true,
      phone: true,
      pinCode: true,
      isActive: true,
    },
  });

  await audit(pin ? "teacher.update_pin" : "teacher.update", {
    schoolId: session.schoolId,
    actorId: session.sub,
    entityType: "user",
    entityId: teacher.id,
  });

  return NextResponse.json({
    ...teacher,
    schoolName: school?.name ?? null,
    temporaryPin: pin || undefined,
  });
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ message: "Accès refusé" }, { status: 403 });
  }

  const { id } = await ctx.params;
  const existing = await prisma.user.findFirst({
    where: {
      id,
      schoolId: session.schoolId!,
      role: "teacher",
      deletedAt: null,
    },
  });
  if (!existing) {
    return NextResponse.json({ message: "Enseignant introuvable" }, { status: 404 });
  }

  await prisma.user.update({
    where: { id },
    data: { deletedAt: new Date(), isActive: false },
  });

  await audit("teacher.delete", {
    schoolId: session.schoolId,
    actorId: session.sub,
    entityType: "user",
    entityId: id,
  });

  return NextResponse.json({ ok: true });
}
