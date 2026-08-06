import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { audit, getSession, verifyPin } from "@/lib/auth";
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

  const lesson = await prisma.lessonSession.findFirst({
    where: { id, deletedAt: null },
  });
  if (!lesson) return NextResponse.json({ message: "Introuvable" }, { status: 404 });
  if (lesson.teacherId !== session.sub && session.role === "teacher") {
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
  if (!teacher || !(await verifyPin(pinConfirm, teacher.pinHash))) {
    await audit("session.validate_fail", {
      schoolId: lesson.schoolId,
      actorId: session.sub,
      entityType: "session",
      entityId: lesson.id,
    });
    return NextResponse.json({ message: "PIN de confirmation incorrect" }, { status: 401 });
  }

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
