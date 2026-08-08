import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { canAccessRoomHub } from "@/lib/access";
import { startOfDayGabon } from "@/lib/datetime";

function parseDay(value: string | null): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [y, m, d] = value.split("-").map(Number);
  return startOfDayGabon(new Date(y, m - 1, d, 12, 0, 0));
}

/** Historique des saisies cahier de textes pour la salle du créneau. */
export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ message: "Non authentifié" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const lesson = await prisma.lessonSession.findFirst({
    where: { id, deletedAt: null },
    include: {
      room: { select: { id: true, label: true, code: true } },
    },
  });
  if (!lesson) {
    return NextResponse.json({ message: "Introuvable" }, { status: 404 });
  }
  if (!canAccessRoomHub(session, lesson)) {
    return NextResponse.json({ message: "Accès refusé" }, { status: 403 });
  }

  const url = new URL(req.url);
  const from = parseDay(url.searchParams.get("from"));
  const to = parseDay(url.searchParams.get("to"));

  const sessionDateFilter: { gte?: Date; lte?: Date } = {};
  if (from) sessionDateFilter.gte = from;
  if (to) sessionDateFilter.lte = to;

  const items = await prisma.lessonSession.findMany({
    where: {
      deletedAt: null,
      roomId: lesson.roomId,
      teacherId: lesson.teacherId,
      schoolId: lesson.schoolId,
      ...(Object.keys(sessionDateFilter).length
        ? { sessionDate: sessionDateFilter }
        : {}),
    },
    include: {
      classroom: { select: { name: true } },
      subject: { select: { name: true } },
    },
    orderBy: [{ sessionDate: "desc" }, { startsAt: "desc" }],
    take: 100,
  });

  return NextResponse.json({
    room: lesson.room,
    currentSessionId: lesson.id,
    filters: {
      from: url.searchParams.get("from") || null,
      to: url.searchParams.get("to") || null,
    },
    items: items.map((s) => ({
      id: s.id,
      sessionDate: s.sessionDate,
      startsAt: s.startsAt,
      endsAt: s.endsAt,
      title: s.title || "(sans titre)",
      status: s.status,
      classroom: s.classroom.name,
      subject: s.subject.name,
      isCurrent: s.id === lesson.id,
      hasContent: !!(s.title.trim() || s.content.trim()),
    })),
  });
}
