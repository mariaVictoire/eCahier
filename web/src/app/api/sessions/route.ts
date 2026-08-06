import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: "Non authentifié" }, { status: 401 });

  const url = new URL(req.url);
  const classroomId = url.searchParams.get("classroomId") || undefined;
  const subjectId = url.searchParams.get("subjectId") || undefined;
  const status = url.searchParams.get("status") || undefined;

  const where: Record<string, unknown> = {
    deletedAt: null,
  };

  if (session.role === "teacher") {
    where.teacherId = session.sub;
  } else if (session.schoolId) {
    where.schoolId = session.schoolId;
  }

  if (classroomId) where.classroomId = classroomId;
  if (subjectId) where.subjectId = subjectId;
  if (status) where.status = status;

  const items = await prisma.lessonSession.findMany({
    where,
    include: {
      classroom: true,
      subject: true,
      room: true,
      teacher: true,
    },
    orderBy: [{ sessionDate: "desc" }, { startsAt: "desc" }],
    take: 100,
  });

  return NextResponse.json({ items });
}
