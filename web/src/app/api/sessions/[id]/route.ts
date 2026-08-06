import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { audit, getSession } from "@/lib/auth";

function isAdmin(role: string) {
  return role === "school_admin" || role === "national_admin";
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: "Non authentifié" }, { status: 401 });

  const { id } = await ctx.params;
  const lesson = await prisma.lessonSession.findFirst({
    where: { id, deletedAt: null },
    include: {
      classroom: true,
      subject: true,
      room: true,
      teacher: true,
      school: true,
    },
  });
  if (!lesson) return NextResponse.json({ message: "Introuvable" }, { status: 404 });

  // Enseignant : uniquement la séance ouverte via PIN en cours
  if (session.role === "teacher" || session.scope === "room") {
    if (session.sessionId !== lesson.id && lesson.teacherId !== session.sub) {
      return NextResponse.json({ message: "Accès refusé" }, { status: 403 });
    }
  } else if (!isAdmin(session.role)) {
    return NextResponse.json({ message: "Accès refusé" }, { status: 403 });
  }

  return NextResponse.json(lesson);
}

export async function PUT(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: "Non authentifié" }, { status: 401 });

  const { id } = await ctx.params;
  const lesson = await prisma.lessonSession.findFirst({
    where: { id, deletedAt: null },
  });
  if (!lesson) return NextResponse.json({ message: "Introuvable" }, { status: 404 });

  const admin = isAdmin(session.role);
  const teacherOwns =
    (session.role === "teacher" || session.scope === "room") &&
    (lesson.teacherId === session.sub || session.sessionId === lesson.id);

  if (!admin && !teacherOwns) {
    return NextResponse.json({ message: "Accès refusé" }, { status: 403 });
  }

  // Enseignant : pas de modification une fois validé — passer par la direction
  if (!admin && (lesson.status === "validated" || lesson.status === "locked")) {
    return NextResponse.json(
      {
        message:
          "Séance déjà validée. Pour une correction, contactez la direction.",
      },
      { status: 422 },
    );
  }

  if (lesson.status === "locked" && !admin) {
    return NextResponse.json({ message: "Séance verrouillée" }, { status: 422 });
  }

  const body = await req.json();
  const updated = await prisma.lessonSession.update({
    where: { id },
    data: {
      title: body.title ?? lesson.title,
      content: body.content ?? lesson.content,
      exercises: body.exercises ?? lesson.exercises,
      homeworkText: body.homeworkText ?? lesson.homeworkText,
      homeworkDueOn: body.homeworkDueOn
        ? new Date(body.homeworkDueOn)
        : body.homeworkDueOn === null
          ? null
          : lesson.homeworkDueOn,
      observations: body.observations ?? lesson.observations,
      competencies: body.competencies
        ? JSON.stringify(body.competencies)
        : lesson.competencies,
      signatureImage:
        body.signatureImage !== undefined
          ? body.signatureImage
          : lesson.signatureImage,
      // Admin qui corrige une séance validée : elle reste validée
      status: admin
        ? lesson.status === "locked"
          ? "locked"
          : lesson.status === "validated"
            ? "validated"
            : body.status === "draft"
              ? "draft"
              : lesson.status
        : "draft",
    },
  });

  if (admin && lesson.status === "validated") {
    await audit("session.admin_correct", {
      schoolId: lesson.schoolId,
      actorId: session.sub,
      entityType: "session",
      entityId: lesson.id,
    });
  }

  return NextResponse.json(updated);
}
