import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { canAccessRoomHub } from "@/lib/access";

type MarkInput = {
  studentId?: string;
  absent?: boolean;
  late?: boolean;
};

function resolveStatus(absent: boolean, late: boolean): "present" | "absent" | "late" {
  if (absent) return "absent";
  if (late) return "late";
  return "present";
}

export async function GET(
  _req: Request,
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
      classroom: { select: { id: true, name: true } },
      subject: { select: { name: true } },
    },
  });
  if (!lesson) {
    return NextResponse.json({ message: "Introuvable" }, { status: 404 });
  }
  if (!canAccessRoomHub(session, lesson)) {
    return NextResponse.json({ message: "Accès refusé" }, { status: 403 });
  }

  const students = await prisma.student.findMany({
    where: {
      classroomId: lesson.classroomId,
      schoolId: lesson.schoolId,
      isActive: true,
      deletedAt: null,
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });

  const records = await prisma.attendanceRecord.findMany({
    where: { sessionId: lesson.id },
  });
  const byStudent = new Map(records.map((r) => [r.studentId, r.status]));

  return NextResponse.json({
    session: {
      id: lesson.id,
      classroom: lesson.classroom.name,
      subject: lesson.subject.name,
      status: lesson.status,
    },
    canEdit:
      lesson.status !== "locked" &&
      (session.scope === "room"
        ? session.sessionId === lesson.id
        : session.role === "school_admin" || session.role === "teacher"),
    items: students.map((s) => {
      const status = byStudent.get(s.id) || "present";
      return {
        studentId: s.id,
        firstName: s.firstName,
        lastName: s.lastName,
        status,
        absent: status === "absent",
        late: status === "late",
      };
    }),
  });
}

export async function PUT(
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
  });
  if (!lesson) {
    return NextResponse.json({ message: "Introuvable" }, { status: 404 });
  }
  if (!canAccessRoomHub(session, lesson)) {
    return NextResponse.json({ message: "Accès refusé" }, { status: 403 });
  }
  if (lesson.status === "locked") {
    return NextResponse.json({ message: "Séance verrouillée" }, { status: 422 });
  }
  if (session.scope === "room" && session.sessionId !== lesson.id) {
    return NextResponse.json({ message: "Accès refusé" }, { status: 403 });
  }

  const body = await req.json();
  const marks = Array.isArray(body.marks) ? (body.marks as MarkInput[]) : [];

  const students = await prisma.student.findMany({
    where: {
      classroomId: lesson.classroomId,
      schoolId: lesson.schoolId,
      isActive: true,
      deletedAt: null,
    },
    select: { id: true },
  });
  const allowed = new Set(students.map((s) => s.id));

  for (const mark of marks) {
    const studentId = String(mark.studentId || "");
    if (!allowed.has(studentId)) continue;
    const status = resolveStatus(!!mark.absent, !!mark.late);

    if (status === "present") {
      await prisma.attendanceRecord.deleteMany({
        where: { sessionId: lesson.id, studentId },
      });
    } else {
      await prisma.attendanceRecord.upsert({
        where: {
          sessionId_studentId: { sessionId: lesson.id, studentId },
        },
        create: { sessionId: lesson.id, studentId, status },
        update: { status },
      });
    }
  }

  return NextResponse.json({ ok: true });
}
