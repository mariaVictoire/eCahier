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

function serializeRoom(
  room: {
    id: string;
    code: string;
    label: string;
    building: string | null;
    publicId: string;
    isActive: boolean;
    homeClassroom?: { name: string } | null;
  },
  base: string,
) {
  return {
    id: room.id,
    code: room.code,
    label: room.homeClassroom?.name || room.label,
    building: room.building,
    publicId: room.publicId,
    isActive: room.isActive,
    classroomName: room.homeClassroom?.name ?? null,
    url: `${base}/room/${room.publicId}`,
  };
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
  const existing = await prisma.room.findFirst({
    where: { id, schoolId: session.schoolId!, deletedAt: null },
  });
  if (!existing) {
    return NextResponse.json({ message: "QR introuvable" }, { status: 404 });
  }

  const body = await req.json();
  const data: {
    isActive?: boolean;
    building?: string | null;
    label?: string;
    homeClassroomId?: string | null;
  } = {};

  if (body.isActive !== undefined) {
    data.isActive = Boolean(body.isActive);
  }
  if (body.building !== undefined) {
    data.building = String(body.building || "").trim() || null;
  }

  const room = await prisma.room.update({
    where: { id },
    data,
    include: {
      homeClassroom: { select: { id: true, name: true, level: true } },
    },
  });

  await audit(
    data.isActive === false
      ? "room.deactivate"
      : data.isActive === true
        ? "room.activate"
        : "room.update",
    {
      schoolId: session.schoolId,
      actorId: session.sub,
      entityType: "room",
      entityId: room.id,
    },
  );

  const base = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  return NextResponse.json(serializeRoom(room, base));
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
  const existing = await prisma.room.findFirst({
    where: { id, schoolId: session.schoolId!, deletedAt: null },
  });
  if (!existing) {
    return NextResponse.json({ message: "QR introuvable" }, { status: 404 });
  }

  await prisma.room.update({
    where: { id },
    data: { deletedAt: new Date(), isActive: false },
  });

  await audit("room.delete", {
    schoolId: session.schoolId,
    actorId: session.sub,
    entityType: "room",
    entityId: id,
  });

  return NextResponse.json({ ok: true });
}
