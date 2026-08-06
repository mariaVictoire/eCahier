import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  audit,
  setSessionCookie,
  signSession,
  verifyPin,
} from "@/lib/auth";
import { combineDateAndTime, resolveCurrentSlot, startOfDay } from "@/lib/slot";
import { createHash } from "crypto";

export async function POST(req: Request) {
  const body = await req.json();
  const roomPublicId = String(body.roomPublicId || "");
  const pin = String(body.pin || "");
  const slotId = body.slotId ? String(body.slotId) : undefined;

  if (!roomPublicId || !/^\d{4,8}$/.test(pin)) {
    return NextResponse.json(
      { message: "PIN invalide (4 à 8 chiffres)" },
      { status: 400 },
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

  // Prefer the teacher expected on the slot (same PIN for several teachers must not break).
  const expected = await prisma.user.findFirst({
    where: {
      id: slot.teacherId,
      role: "teacher",
      isActive: true,
      deletedAt: null,
    },
  });

  let matched = null as typeof expected;
  if (
    expected &&
    !(expected.pinLockedUntil && expected.pinLockedUntil > new Date()) &&
    (await verifyPin(pin, expected.pinHash))
  ) {
    matched = expected;
  }

  if (!matched) {
    await prisma.user.update({
      where: { id: slot.teacherId },
      data: {
        pinFailedAttempts: { increment: 1 },
      },
    });
    await audit("pin.fail", {
      schoolId: slot.schoolId,
      entityType: "room",
      entityId: resolved.room.id,
      meta: { slotId: slot.id },
    });
    return NextResponse.json({ message: "Code PIN incorrect" }, { status: 401 });
  }

  await prisma.user.update({
    where: { id: matched.id },
    data: { pinFailedAttempts: 0, pinLockedUntil: null, lastLoginAt: new Date() },
  });

  const now = new Date();
  const sessionDate = startOfDay(now);

  let session = await prisma.lessonSession.findFirst({
    where: {
      slotId: slot.id,
      teacherId: matched.id,
      sessionDate,
      deletedAt: null,
    },
  });

  if (!session) {
    session = await prisma.lessonSession.create({
      data: {
        schoolId: slot.schoolId,
        schoolYearId: slot.schoolYearId,
        roomId: slot.roomId,
        classroomId: slot.classroomId,
        subjectId: slot.subjectId,
        teacherId: matched.id,
        slotId: slot.id,
        sessionDate,
        startsAt: combineDateAndTime(now, slot.startsAt),
        endsAt: combineDateAndTime(now, slot.endsAt),
        status: "draft",
      },
    });
  }

  const token = await signSession(
    {
      sub: matched.id,
      role: matched.role,
      schoolId: matched.schoolId,
      firstName: matched.firstName,
      lastName: matched.lastName,
      scope: "room",
      slotId: slot.id,
      roomId: slot.roomId,
      sessionId: session.id,
    },
    "2h",
  );
  await setSessionCookie(token);

  const signaturePreview = createHash("sha256")
    .update(`${session.id}:${matched.id}`)
    .digest("hex")
    .slice(0, 12);

  await audit("pin.ok", {
    schoolId: slot.schoolId,
    actorId: matched.id,
    entityType: "session",
    entityId: session.id,
    meta: { slotId: slot.id, signaturePreview },
  });

  return NextResponse.json({
    sessionId: session.id,
    teacher: {
      id: matched.id,
      displayName: `${matched.firstName} ${matched.lastName}`,
    },
    slot,
  });
}
