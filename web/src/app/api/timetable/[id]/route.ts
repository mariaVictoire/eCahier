import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { audit, getSession } from "@/lib/auth";

async function requireAdmin() {
  const session = await getSession();
  if (!session?.schoolId || !["school_admin", "national_admin"].includes(session.role)) {
    return null;
  }
  return session;
}

function parseHm(v: string) {
  return /^\d{2}:\d{2}$/.test(v);
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ message: "Accès refusé" }, { status: 403 });

  const { id } = await ctx.params;
  const existing = await prisma.timetableSlot.findFirst({
    where: { id, schoolId: session.schoolId!, deletedAt: null },
  });
  if (!existing) return NextResponse.json({ message: "Introuvable" }, { status: 404 });

  const body = await req.json();
  const weekday = body.weekday ? String(body.weekday) : existing.weekday;
  const startsAt = body.startsAt ? String(body.startsAt) : existing.startsAt;
  const endsAt = body.endsAt ? String(body.endsAt) : existing.endsAt;
  const classroomId = body.classroomId
    ? String(body.classroomId)
    : existing.classroomId;
  const subjectId = body.subjectId ? String(body.subjectId) : existing.subjectId;
  const teacherId = body.teacherId ? String(body.teacherId) : existing.teacherId;

  let roomId = body.roomId ? String(body.roomId) : existing.roomId;
  if (body.classroomId && !body.roomId) {
    const linked = await prisma.room.findFirst({
      where: {
        schoolId: session.schoolId!,
        homeClassroomId: classroomId,
        deletedAt: null,
      },
      orderBy: { createdAt: "asc" },
    });
    if (linked) roomId = linked.id;
  }

  if (
    !["mon", "tue", "wed", "thu", "fri", "sat", "sun"].includes(weekday) ||
    !parseHm(startsAt) ||
    !parseHm(endsAt) ||
    endsAt <= startsAt
  ) {
    return NextResponse.json({ message: "Données créneau invalides" }, { status: 400 });
  }

  const slot = await prisma.timetableSlot.update({
    where: { id },
    data: {
      weekday,
      startsAt,
      endsAt,
      roomId,
      classroomId,
      subjectId,
      teacherId,
    },
    include: {
      room: true,
      classroom: true,
      subject: true,
      teacher: true,
    },
  });

  await audit("timetable.update", {
    schoolId: session.schoolId,
    actorId: session.sub,
    entityType: "timetable_slot",
    entityId: slot.id,
  });

  return NextResponse.json(slot);
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ message: "Accès refusé" }, { status: 403 });

  const { id } = await ctx.params;
  const existing = await prisma.timetableSlot.findFirst({
    where: { id, schoolId: session.schoolId!, deletedAt: null },
  });
  if (!existing) return NextResponse.json({ message: "Introuvable" }, { status: 404 });

  await prisma.timetableSlot.update({
    where: { id },
    data: { deletedAt: new Date() },
  });

  await audit("timetable.delete", {
    schoolId: session.schoolId,
    actorId: session.sub,
    entityType: "timetable_slot",
    entityId: id,
  });

  return NextResponse.json({ ok: true });
}
