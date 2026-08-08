import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { audit, getSession, verifyPin } from "@/lib/auth";
import {
  canValidateLesson,
  PIN_LOCK_MINUTES,
  PIN_MAX_ATTEMPTS,
  pinLockUntilFromAttempts,
} from "@/lib/access";
import { createHash } from "crypto";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: "Non authentifié" }, { status: 401 });

  const { id } = await ctx.params;
  const body = await req.json();
  const pinConfirm = String(body.pinConfirm || "");
  const signatureImage =
    typeof body.signatureImage === "string" ? body.signatureImage : null;

  if (!/^\d{6}$/.test(pinConfirm)) {
    return NextResponse.json(
      { message: "PIN invalide (6 chiffres)" },
      { status: 400 },
    );
  }

  const lesson = await prisma.lessonSession.findFirst({
    where: { id, deletedAt: null },
  });
  if (!lesson) return NextResponse.json({ message: "Introuvable" }, { status: 404 });

  if (!canValidateLesson(session, lesson)) {
    return NextResponse.json({ message: "Accès refusé" }, { status: 403 });
  }

  if (!lesson.title.trim() || !lesson.content.trim()) {
    return NextResponse.json(
      { message: "Titre et contenu obligatoires avant validation" },
      { status: 422 },
    );
  }

  const finalSignature = signatureImage || lesson.signatureImage;
  if (!finalSignature || !finalSignature.startsWith("data:image/")) {
    return NextResponse.json(
      { message: "Signature électronique obligatoire" },
      { status: 422 },
    );
  }

  const teacher = await prisma.user.findUnique({ where: { id: lesson.teacherId } });
  if (!teacher) {
    return NextResponse.json({ message: "Enseignant introuvable" }, { status: 422 });
  }

  if (teacher.pinLockedUntil && teacher.pinLockedUntil > new Date()) {
    const mins = Math.max(
      1,
      Math.ceil((teacher.pinLockedUntil.getTime() - Date.now()) / 60000),
    );
    return NextResponse.json(
      { message: `PIN temporairement bloqué. Réessayez dans ${mins} min.` },
      { status: 423 },
    );
  }

  if (!(await verifyPin(pinConfirm, teacher.pinHash))) {
    const nextAttempts = teacher.pinFailedAttempts + 1;
    const lockUntil = pinLockUntilFromAttempts(nextAttempts);
    await prisma.user.update({
      where: { id: teacher.id },
      data: {
        pinFailedAttempts: nextAttempts,
        pinLockedUntil: lockUntil,
      },
    });
    await audit("session.validate_fail", {
      schoolId: lesson.schoolId,
      actorId: session.sub,
      entityType: "session",
      entityId: lesson.id,
      meta: { attempts: nextAttempts },
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
            ? `PIN incorrect (${left} essai${left > 1 ? "s" : ""} restant${left > 1 ? "s" : ""})`
            : "PIN de confirmation incorrect",
      },
      { status: 401 },
    );
  }

  await prisma.user.update({
    where: { id: teacher.id },
    data: { pinFailedAttempts: 0, pinLockedUntil: null },
  });
  const validatedAt = new Date();
  const signatureHash = createHash("sha256")
    .update(
      `${lesson.id}|${lesson.teacherId}|${validatedAt.toISOString()}|${lesson.title}|${lesson.content}|${finalSignature.length}`,
    )
    .digest("hex");

  const updated = await prisma.lessonSession.update({
    where: { id },
    data: {
      status: "validated",
      validatedAt,
      signatureHash,
      signatureImage: finalSignature,
    },
  });

  await audit("session.validate", {
    schoolId: lesson.schoolId,
    actorId: session.sub,
    entityType: "session",
    entityId: lesson.id,
  });

  return NextResponse.json(updated);
}
