import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { audit, getSession } from "@/lib/auth";
import {
  CLASS_LEVELS,
  classroomName,
  nextSectionLetter,
} from "@/lib/classrooms";
import { ensureSchoolYearCurrent } from "@/lib/school-year";

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

export async function GET() {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ message: "Accès refusé" }, { status: 403 });
  }

  await ensureSchoolYearCurrent(session.schoolId!);

  const year = await prisma.schoolYear.findFirst({
    where: { schoolId: session.schoolId!, isCurrent: true },
  });
  if (!year) {
    return NextResponse.json(
      { message: "Aucune année scolaire en cours" },
      { status: 400 },
    );
  }

  const classrooms = await prisma.classroom.findMany({
    where: {
      schoolId: session.schoolId!,
      schoolYearId: year.id,
      deletedAt: null,
    },
    orderBy: [{ level: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      level: true,
      notes: true,
    },
  });

  return NextResponse.json({
    items: classrooms,
    schoolYear: { id: year.id, label: year.label },
    levels: CLASS_LEVELS,
  });
}

export async function POST(req: Request) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ message: "Accès refusé" }, { status: 403 });
  }

  const body = await req.json();
  const level = String(body.level || "").trim();
  const notes = String(body.notes || "").trim() || null;

  if (!level || !(CLASS_LEVELS as readonly string[]).includes(level)) {
    return NextResponse.json(
      { message: "Niveau invalide" },
      { status: 400 },
    );
  }

  const year = await prisma.schoolYear.findFirst({
    where: { schoolId: session.schoolId!, isCurrent: true },
  });
  if (!year) {
    return NextResponse.json(
      { message: "Aucune année scolaire en cours" },
      { status: 400 },
    );
  }

  const existing = await prisma.classroom.findMany({
    where: {
      schoolId: session.schoolId!,
      schoolYearId: year.id,
      level,
      deletedAt: null,
    },
    select: { name: true },
  });

  let letter: string;
  try {
    letter = nextSectionLetter(
      level,
      existing.map((c) => c.name),
    );
  } catch {
    return NextResponse.json(
      { message: "Toutes les lettres A–Z sont déjà utilisées pour ce niveau" },
      { status: 409 },
    );
  }

  const name = classroomName(level, letter);

  const classroom = await prisma.classroom.create({
    data: {
      schoolId: session.schoolId!,
      schoolYearId: year.id,
      name,
      level,
      notes,
    },
    select: {
      id: true,
      name: true,
      level: true,
      notes: true,
    },
  });

  await audit("classroom.create", {
    schoolId: session.schoolId,
    actorId: session.sub,
    entityType: "classroom",
    entityId: classroom.id,
    meta: { name, level, notes },
  });

  return NextResponse.json(classroom, { status: 201 });
}
