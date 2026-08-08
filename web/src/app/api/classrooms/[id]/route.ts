import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { audit, getSession } from "@/lib/auth";
import { ensureClassroomHomeRoom } from "@/lib/ensure-classroom-room";

async function requireSchoolAdmin() {
  const session = await getSession();
  if (!session?.schoolId || session.role !== "school_admin") {
    return null;
  }
  return session;
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await requireSchoolAdmin();
  if (!session) {
    return NextResponse.json({ message: "Accès refusé" }, { status: 403 });
  }

  const { id } = await ctx.params;
  const classroom = await prisma.classroom.findFirst({
    where: { id, schoolId: session.schoolId!, deletedAt: null },
  });
  if (!classroom) {
    return NextResponse.json({ message: "Classe introuvable" }, { status: 404 });
  }

  const room = await ensureClassroomHomeRoom(classroom);

  const studentsCount = await prisma.student.count({
    where: {
      classroomId: classroom.id,
      deletedAt: null,
      isActive: true,
    },
  });

  const base = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  return NextResponse.json({
    id: classroom.id,
    name: classroom.name,
    level: classroom.level,
    notes: classroom.notes,
    studentsCount,
    room: {
      id: room.id,
      code: room.code,
      publicId: room.publicId,
      isActive: room.isActive,
      url: `${base}/room/${room.publicId}`,
    },
  });
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await requireSchoolAdmin();
  if (!session) {
    return NextResponse.json({ message: "Accès refusé" }, { status: 403 });
  }

  const { id } = await ctx.params;
  const classroom = await prisma.classroom.findFirst({
    where: { id, schoolId: session.schoolId!, deletedAt: null },
    include: {
      homeRooms: {
        where: { deletedAt: null },
        take: 1,
      },
    },
  });
  if (!classroom) {
    return NextResponse.json({ message: "Classe introuvable" }, { status: 404 });
  }

  const body = await req.json();
  const name =
    body.name !== undefined ? String(body.name || "").trim() : undefined;
  const notes =
    body.notes !== undefined
      ? String(body.notes || "").trim() || null
      : undefined;
  const code =
    body.code !== undefined
      ? String(body.code || "")
          .trim()
          .toUpperCase()
      : undefined;

  if (name !== undefined) {
    if (!name) {
      return NextResponse.json({ message: "Nom requis" }, { status: 400 });
    }
    const clash = await prisma.classroom.findFirst({
      where: {
        schoolId: session.schoolId!,
        schoolYearId: classroom.schoolYearId,
        name,
        deletedAt: null,
        NOT: { id },
      },
    });
    if (clash) {
      return NextResponse.json(
        { message: "Une classe porte déjà ce nom" },
        { status: 409 },
      );
    }
  }

  const room = classroom.homeRooms[0];
  if (code !== undefined) {
    if (!code) {
      return NextResponse.json({ message: "Code requis" }, { status: 400 });
    }
    if (!room) {
      return NextResponse.json(
        { message: "Aucun QR lié à cette classe" },
        { status: 422 },
      );
    }
    const clash = await prisma.room.findFirst({
      where: {
        schoolId: session.schoolId!,
        code,
        deletedAt: null,
        NOT: { id: room.id },
      },
    });
    if (clash) {
      return NextResponse.json(
        { message: "Ce code salle est déjà utilisé" },
        { status: 409 },
      );
    }
  }

  const updated = await prisma.classroom.update({
    where: { id },
    data: {
      ...(name !== undefined ? { name } : {}),
      ...(notes !== undefined ? { notes } : {}),
    },
  });

  if (room && (name !== undefined || code !== undefined || notes !== undefined)) {
    await prisma.room.update({
      where: { id: room.id },
      data: {
        ...(name !== undefined ? { label: name } : {}),
        ...(code !== undefined ? { code } : {}),
        ...(notes !== undefined ? { building: notes } : {}),
      },
    });
  }

  await audit("classroom.update", {
    schoolId: session.schoolId,
    actorId: session.sub,
    entityType: "classroom",
    entityId: id,
    meta: { name: updated.name, code },
  });

  return NextResponse.json({
    id: updated.id,
    name: updated.name,
    notes: updated.notes,
  });
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await requireSchoolAdmin();
  if (!session) {
    return NextResponse.json({ message: "Accès refusé" }, { status: 403 });
  }

  const { id } = await ctx.params;
  const classroom = await prisma.classroom.findFirst({
    where: { id, schoolId: session.schoolId!, deletedAt: null },
    include: {
      homeRooms: { where: { deletedAt: null }, select: { id: true } },
    },
  });
  if (!classroom) {
    return NextResponse.json({ message: "Classe introuvable" }, { status: 404 });
  }

  const now = new Date();
  await prisma.$transaction([
    prisma.classroom.update({
      where: { id },
      data: { deletedAt: now },
    }),
    ...classroom.homeRooms.map((r) =>
      prisma.room.update({
        where: { id: r.id },
        data: { deletedAt: now, isActive: false },
      }),
    ),
  ]);

  await audit("classroom.delete", {
    schoolId: session.schoolId,
    actorId: session.sub,
    entityType: "classroom",
    entityId: id,
  });

  return NextResponse.json({ ok: true });
}
