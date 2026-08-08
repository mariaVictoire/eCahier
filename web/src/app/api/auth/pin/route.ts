import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  audit,
  setSessionCookie,
  signSession,
  verifyPin,
} from "@/lib/auth";
import { shortDisplayName } from "@/lib/person-name";
import { PIN_LOCK_MINUTES, PIN_MAX_ATTEMPTS, pinLockUntilFromAttempts } from "@/lib/access";
import { isClosedSchoolDay } from "@/lib/holidays";
import { combineDateAndTime, resolveCurrentSlot, startOfDay } from "@/lib/slot";
import { createHash } from "crypto";

export async function POST(req: Request) {
  const body = await req.json();
  const roomPublicId = String(body.roomPublicId || "");
  const pin = String(body.pin || "");
  const slotId = body.slotId ? String(body.slotId) : undefined;

  if (!roomPublicId || !/^\d{6}$/.test(pin)) {
    return NextResponse.json(
      { message: "PIN invalide (6 chiffres)" },
      { status: 400 },
    );
  }

  const closed = await isClosedSchoolDay(new Date());
  if (closed.closed) {
    return NextResponse.json(
      { message: closed.reason || "Établissement fermé aujourd’hui" },
      { status: 422 },
    );
  }

  const resolved = await resolveCurrentSlot(roomPublicId);
  if (!resolved.room) {
    return NextResponse.json({ message: "Salle introuvable" }, { status: 404 });
  }

  const slot =
    (slotId
      ? resolved.candidates.find((c) => c.id === slotId) ||
        (resolved.slot?.id === slotId ? resolved.slot : null)
      : resolved.slot) ||
    resolved.candidates[0] ||
    null;

  if (!slot) {
    return NextResponse.json(
      { message: "Aucun créneau trouvé pour cette salle" },
      { status: 422 },
    );
  }

  const expected = await prisma.user.findFirst({
    where: {
      id: slot.teacherId,
      role: "teacher",
      isActive: true,
      deletedAt: null,
    },
  });

  if (!expected) {
    return NextResponse.json(
      { message: "Enseignant du créneau introuvable" },
      { status: 422 },
    );
  }

  if (expected.pinLockedUntil && expected.pinLockedUntil > new Date()) {
    const mins = Math.max(
      1,
      Math.ceil((expected.pinLockedUntil.getTime() - Date.now()) / 60000),
    );
    return NextResponse.json(
      {
        message: `PIN temporairement bloqué. Réessayez dans ${mins} min.`,
      },
      { status: 423 },
    );
  }

  const pinOk = await verifyPin(pin, expected.pinHash);
  if (!pinOk) {
    const nextAttempts = expected.pinFailedAttempts + 1;
    const lockUntil = pinLockUntilFromAttempts(nextAttempts);
    await prisma.user.update({
      where: { id: expected.id },
      data: {
        pinFailedAttempts: nextAttempts,
        pinLockedUntil: lockUntil,
      },
    });
    await audit("pin.fail", {
      schoolId: slot.schoolId,
      entityType: "room",
      entityId: resolved.room.id,
      meta: { slotId: slot.id, attempts: nextAttempts },
    });
    if (lockUntil) {
      return NextResponse.json(
        {
          message: `Trop d’essais. PIN bloqué ${PIN_LOCK_MINUTES} minutes.`,
        },
        { status: 423 },
      );
    }
    const left = PIN_MAX_ATTEMPTS - nextAttempts;
    return NextResponse.json(
      {
        message:
          left > 0
            ? `Code PIN incorrect (${left} essai${left > 1 ? "s" : ""} restant${left > 1 ? "s" : ""})`
            : "Code PIN incorrect",
      },
      { status: 401 },
    );
  }

  await prisma.user.update({
    where: { id: expected.id },
    data: {
      pinFailedAttempts: 0,
      pinLockedUntil: null,
      lastLoginAt: new Date(),
    },
  });

  const now = new Date();
  const sessionDate = startOfDay(now);

  let session = await prisma.lessonSession.findFirst({
    where: {
      slotId: slot.id,
      sessionDate,
    },
  });

  if (session?.deletedAt) {
    session = await prisma.lessonSession.update({
      where: { id: session.id },
      data: {
        deletedAt: null,
        teacherId: expected.id,
        roomId: slot.roomId,
        classroomId: slot.classroomId,
        subjectId: slot.subjectId,
        schoolYearId: slot.schoolYearId,
        startsAt: combineDateAndTime(now, slot.startsAt),
        endsAt: combineDateAndTime(now, slot.endsAt),
        status: "draft",
        title: "",
        content: "",
        validatedAt: null,
        signatureHash: null,
        signatureImage: null,
      },
    });
  }

  if (!session) {
    try {
      session = await prisma.lessonSession.create({
        data: {
          schoolId: slot.schoolId,
          schoolYearId: slot.schoolYearId,
          roomId: slot.roomId,
          classroomId: slot.classroomId,
          subjectId: slot.subjectId,
          teacherId: expected.id,
          slotId: slot.id,
          sessionDate,
          startsAt: combineDateAndTime(now, slot.startsAt),
          endsAt: combineDateAndTime(now, slot.endsAt),
          status: "draft",
        },
      });
    } catch {
      // Course condition / unique : récupérer la séance existante
      session = await prisma.lessonSession.findFirst({
        where: { slotId: slot.id, sessionDate },
      });
      if (!session) {
        return NextResponse.json(
          { message: "Impossible d’ouvrir la séance" },
          { status: 500 },
        );
      }
    }
  }
  // La séance appartient à un autre enseignant (créneau déjà ouvert)
  if (session.teacherId !== expected.id) {
    return NextResponse.json(
      {
        message:
          "Une séance est déjà ouverte pour ce créneau par un autre enseignant.",
      },
      { status: 409 },
    );
  }

  const token = await signSession(
    {
      sub: expected.id,
      role: expected.role,
      schoolId: expected.schoolId,
      firstName: expected.firstName,
      lastName: expected.lastName,
      scope: "room",
      slotId: slot.id,
      roomId: slot.roomId,
      sessionId: session.id,
    },
    "2h",
  );
  await setSessionCookie(token);

  const signaturePreview = createHash("sha256")
    .update(`${session.id}:${expected.id}`)
    .digest("hex")
    .slice(0, 12);

  await audit("pin.ok", {
    schoolId: slot.schoolId,
    actorId: expected.id,
    entityType: "session",
    entityId: session.id,
    meta: { slotId: slot.id, signaturePreview },
  });

  return NextResponse.json({
    sessionId: session.id,
    teacher: {
      id: expected.id,
      displayName: shortDisplayName(expected),
    },
    slot,
  });
}
