import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { audit, getSession } from "@/lib/auth";
import {
  normalizeStudent,
  parseStudentsImport,
} from "@/lib/students-import";

async function requireSchoolAdmin() {
  const session = await getSession();
  if (!session?.schoolId || session.role !== "school_admin") {
    return null;
  }
  return session;
}

async function getClassroom(id: string, schoolId: string) {
  return prisma.classroom.findFirst({
    where: { id, schoolId, deletedAt: null },
  });
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
  const classroom = await getClassroom(id, session.schoolId!);
  if (!classroom) {
    return NextResponse.json({ message: "Classe introuvable" }, { status: 404 });
  }

  const students = await prisma.student.findMany({
    where: {
      classroomId: id,
      schoolId: session.schoolId!,
      deletedAt: null,
      isActive: true,
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    select: {
      id: true,
      firstName: true,
      lastName: true,
      studentCode: true,
    },
  });

  return NextResponse.json({
    classroom: { id: classroom.id, name: classroom.name },
    items: students,
  });
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await requireSchoolAdmin();
  if (!session) {
    return NextResponse.json({ message: "Accès refusé" }, { status: 403 });
  }
  const { id } = await ctx.params;
  const classroom = await getClassroom(id, session.schoolId!);
  if (!classroom) {
    return NextResponse.json({ message: "Classe introuvable" }, { status: 404 });
  }

  const body = await req.json();
  let toCreate: {
    firstName: string;
    lastName: string;
    studentCode: string | null;
  }[] = [];

  try {
    if (typeof body.raw === "string") {
      toCreate = parseStudentsImport(body.raw);
    } else if (Array.isArray(body.students)) {
      toCreate = body.students
        .map((row: Record<string, unknown>) => normalizeStudent(row))
        .filter(Boolean) as typeof toCreate;
    } else {
      const one = normalizeStudent(body);
      if (one) toCreate = [one];
    }
  } catch (e) {
    return NextResponse.json(
      { message: e instanceof Error ? e.message : "Import invalide" },
      { status: 400 },
    );
  }

  if (toCreate.length === 0) {
    return NextResponse.json(
      { message: "Aucun élève valide (prénom + nom requis)" },
      { status: 400 },
    );
  }

  const created = await prisma.$transaction(
    toCreate.map((s) =>
      prisma.student.create({
        data: {
          schoolId: session.schoolId!,
          classroomId: id,
          firstName: s.firstName,
          lastName: s.lastName,
          studentCode: s.studentCode,
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          studentCode: true,
        },
      }),
    ),
  );

  await audit("students.import", {
    schoolId: session.schoolId,
    actorId: session.sub,
    entityType: "classroom",
    entityId: id,
    meta: { count: created.length },
  });

  return NextResponse.json(
    { items: created, count: created.length },
    { status: 201 },
  );
}

export async function DELETE(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await requireSchoolAdmin();
  if (!session) {
    return NextResponse.json({ message: "Accès refusé" }, { status: 403 });
  }
  const { id } = await ctx.params;
  const classroom = await getClassroom(id, session.schoolId!);
  if (!classroom) {
    return NextResponse.json({ message: "Classe introuvable" }, { status: 404 });
  }

  const url = new URL(req.url);
  const studentId = url.searchParams.get("studentId");
  if (!studentId) {
    return NextResponse.json({ message: "studentId requis" }, { status: 400 });
  }

  const student = await prisma.student.findFirst({
    where: {
      id: studentId,
      classroomId: id,
      schoolId: session.schoolId!,
      deletedAt: null,
    },
  });
  if (!student) {
    return NextResponse.json({ message: "Élève introuvable" }, { status: 404 });
  }

  await prisma.student.update({
    where: { id: student.id },
    data: { deletedAt: new Date(), isActive: false },
  });

  await audit("student.delete", {
    schoolId: session.schoolId,
    actorId: session.sub,
    entityType: "student",
    entityId: student.id,
  });

  return NextResponse.json({ ok: true });
}
