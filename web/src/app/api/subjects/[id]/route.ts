import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { audit, getSession } from "@/lib/auth";

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
  const existing = await prisma.subject.findFirst({
    where: { id, schoolId: session.schoolId! },
  });
  if (!existing) {
    return NextResponse.json({ message: "Matière introuvable" }, { status: 404 });
  }

  const body = await req.json();
  const name =
    body.name !== undefined ? String(body.name || "").trim() : undefined;
  const code =
    body.code !== undefined
      ? String(body.code || "")
          .trim()
          .toUpperCase()
      : undefined;

  if (name !== undefined && !name) {
    return NextResponse.json({ message: "Nom requis" }, { status: 400 });
  }
  if (code !== undefined && !code) {
    return NextResponse.json({ message: "Code requis" }, { status: 400 });
  }

  if (name !== undefined) {
    const clash = await prisma.subject.findFirst({
      where: {
        schoolId: session.schoolId!,
        name: { equals: name },
        NOT: { id },
      },
    });
    if (clash) {
      return NextResponse.json(
        { message: "Une matière porte déjà ce nom" },
        { status: 409 },
      );
    }
  }

  if (code !== undefined) {
    const clash = await prisma.subject.findFirst({
      where: {
        schoolId: session.schoolId!,
        code,
        NOT: { id },
      },
    });
    if (clash) {
      return NextResponse.json(
        { message: "Ce code matière est déjà utilisé" },
        { status: 409 },
      );
    }
  }

  const subject = await prisma.subject.update({
    where: { id },
    data: {
      ...(name !== undefined ? { name } : {}),
      ...(code !== undefined ? { code } : {}),
    },
    select: { id: true, name: true, code: true },
  });

  await audit("subject.update", {
    schoolId: session.schoolId,
    actorId: session.sub,
    entityType: "subject",
    entityId: id,
    meta: { name: subject.name, code: subject.code },
  });

  return NextResponse.json(subject);
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
  const existing = await prisma.subject.findFirst({
    where: { id, schoolId: session.schoolId! },
    include: {
      _count: {
        select: {
          slots: { where: { deletedAt: null } },
          sessions: { where: { deletedAt: null } },
        },
      },
    },
  });
  if (!existing) {
    return NextResponse.json({ message: "Matière introuvable" }, { status: 404 });
  }

  if (existing._count.slots > 0 || existing._count.sessions > 0) {
    return NextResponse.json(
      {
        message:
          "Impossible de supprimer : matière utilisée dans l’emploi du temps ou des cahiers.",
      },
      { status: 409 },
    );
  }

  await prisma.subject.delete({ where: { id } });

  await audit("subject.delete", {
    schoolId: session.schoolId,
    actorId: session.sub,
    entityType: "subject",
    entityId: id,
    meta: { name: existing.name, code: existing.code },
  });

  return NextResponse.json({ ok: true });
}
