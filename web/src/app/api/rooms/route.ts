import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/auth";
import {
  CLASS_LEVELS,
  classroomName,
  nextSectionLetter,
  roomCodeFromLevelAndLetter,
} from "@/lib/classrooms";
import { resolveSchoolAdmin } from "@/lib/admin-context";

function makePublicId(code: string) {
  const slug = code
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
  return `rm_${slug}_${Date.now().toString(36).slice(-4)}`;
}

export async function GET() {
  const auth = await resolveSchoolAdmin();
  if (!auth.ok) {
    return NextResponse.json(
      { message: auth.message, code: auth.code },
      { status: auth.status },
    );
  }
  const { schoolId } = auth.ctx;

  const year = await prisma.schoolYear.findFirst({
    where: { schoolId, isCurrent: true },
  });

  const [rooms, classrooms] = await Promise.all([
    prisma.room.findMany({
      where: { schoolId, deletedAt: null },
      include: {
        homeClassroom: { select: { id: true, name: true, level: true } },
      },
      orderBy: { code: "asc" },
    }),
    year
      ? prisma.classroom.findMany({
          where: {
            schoolId,
            schoolYearId: year.id,
            deletedAt: null,
          },
          select: { id: true, name: true, level: true, notes: true },
          orderBy: { name: "asc" },
        })
      : Promise.resolve([]),
  ]);

  const base = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  return NextResponse.json({
    baseUrl: base,
    levels: CLASS_LEVELS,
    classrooms,
    items: rooms.map((r) => ({
      id: r.id,
      code: r.code,
      label: r.homeClassroom?.name || r.label,
      building: r.building,
      publicId: r.publicId,
      isActive: r.isActive,
      classroomName: r.homeClassroom?.name ?? null,
      url: `${base}/room/${r.publicId}`,
    })),
  });
}

export async function POST(req: Request) {
  const auth = await resolveSchoolAdmin();
  if (!auth.ok) {
    return NextResponse.json(
      { message: auth.message, code: auth.code },
      { status: auth.status },
    );
  }
  const { schoolId, userId } = auth.ctx;

  const body = await req.json();
  const level = String(body.level || "").trim();
  const notes = String(body.notes || body.building || "").trim() || null;

  if (!level || !(CLASS_LEVELS as readonly string[]).includes(level)) {
    return NextResponse.json({ message: "Niveau invalide" }, { status: 400 });
  }

  const year = await prisma.schoolYear.findFirst({
    where: { schoolId, isCurrent: true },
  });
  if (!year) {
    return NextResponse.json(
      { message: "Aucune année scolaire en cours" },
      { status: 400 },
    );
  }

  const existingClasses = await prisma.classroom.findMany({
    where: {
      schoolId,
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
      existingClasses.map((c) => c.name),
    );
  } catch {
    return NextResponse.json(
      { message: "Toutes les lettres A–Z sont déjà utilisées pour ce niveau" },
      { status: 409 },
    );
  }

  const name = classroomName(level, letter);
  let code = roomCodeFromLevelAndLetter(level, letter);

  const codeClash = await prisma.room.findFirst({
    where: { schoolId, code, deletedAt: null },
  });
  if (codeClash) {
    code = `${code}${Date.now().toString(36).slice(-2)}`.toUpperCase();
  }

  const classroom = await prisma.classroom.create({
    data: {
      schoolId,
      schoolYearId: year.id,
      name,
      level,
      notes,
    },
  });

  const room = await prisma.room.create({
    data: {
      schoolId,
      code,
      label: name,
      building: notes,
      homeClassroomId: classroom.id,
      publicId: makePublicId(code),
    },
  });

  await audit("classroom.create", {
    schoolId,
    actorId: userId,
    entityType: "classroom",
    entityId: classroom.id,
    meta: { name, level },
  });
  await audit("room.create", {
    schoolId,
    actorId: userId,
    entityType: "room",
    entityId: room.id,
    meta: { code: room.code, label: name },
  });

  const base = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const url = `${base}/room/${room.publicId}`;

  const QRCode = (await import("qrcode")).default;
  const qrDataUrl = await QRCode.toDataURL(url, {
    width: 320,
    margin: 1,
    color: { dark: "#004D2E", light: "#FFFFFF" },
  });

  return NextResponse.json(
    {
      id: room.id,
      code: room.code,
      label: name,
      building: notes,
      publicId: room.publicId,
      classroomName: name,
      classroomId: classroom.id,
      url,
      qrDataUrl,
    },
    { status: 201 },
  );
}
