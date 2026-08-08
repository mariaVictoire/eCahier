import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/auth";
import {
  CLASS_LEVELS,
  classroomName,
  nextSectionLetter,
  roomCodeFromLevelAndLetter,
} from "@/lib/classrooms";
import { ensureSchoolYearCurrent } from "@/lib/school-year";
import { resolveSchoolAdmin } from "@/lib/admin-context";
import { ensureClassroomHomeRoom } from "@/lib/ensure-classroom-room";

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

  try {
    await ensureSchoolYearCurrent(schoolId);
  } catch (err) {
    if (err instanceof Error && err.message === "SCHOOL_NOT_FOUND") {
      return NextResponse.json(
        {
          message:
            "Établissement introuvable. Reconnectez-vous (admin@lycee.ga / admin123).",
          code: "SCHOOL_NOT_FOUND",
        },
        { status: 401 },
      );
    }
    console.error("[classrooms GET] school year", err);
    return NextResponse.json(
      { message: "Impossible de charger l’année scolaire" },
      { status: 500 },
    );
  }

  try {
    const year = await prisma.schoolYear.findFirst({
      where: { schoolId, isCurrent: true },
    });
    if (!year) {
      return NextResponse.json(
        { message: "Aucune année scolaire en cours" },
        { status: 400 },
      );
    }

    const classrooms = await prisma.classroom.findMany({
      where: {
        schoolId,
        schoolYearId: year.id,
        deletedAt: null,
      },
      orderBy: [{ level: "asc" }, { name: "asc" }],
      include: {
        homeRooms: {
          where: { deletedAt: null },
          orderBy: { createdAt: "asc" },
          take: 1,
          select: {
            id: true,
            code: true,
            publicId: true,
            isActive: true,
            label: true,
          },
        },
      },
    });

    const classIds = classrooms.map((c) => c.id);
    const counts =
      classIds.length === 0
        ? []
        : await prisma.student.groupBy({
            by: ["classroomId"],
            where: {
              schoolId,
              classroomId: { in: classIds },
              deletedAt: null,
              isActive: true,
            },
            _count: { _all: true },
          });
    const countByClass = new Map(
      counts.map((row) => [row.classroomId, row._count._all]),
    );

    const base = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    const items = await Promise.all(
      classrooms.map(async (c) => {
        const room =
          c.homeRooms[0] ||
          (await ensureClassroomHomeRoom({
            id: c.id,
            schoolId: c.schoolId,
            name: c.name,
            level: c.level,
            notes: c.notes,
          }));
        return {
          id: c.id,
          name: c.name,
          level: c.level,
          notes: c.notes,
          studentsCount: countByClass.get(c.id) ?? 0,
          room: {
            id: room.id,
            code: room.code,
            publicId: room.publicId,
            isActive: room.isActive,
            url: `${base}/room/${room.publicId}`,
          },
        };
      }),
    );

    return NextResponse.json({
      items,
      schoolYear: { id: year.id, label: year.label },
      levels: CLASS_LEVELS,
      baseUrl: base,
    });
  } catch (err) {
    console.error("[classrooms GET]", err);
    return NextResponse.json(
      { message: "Impossible de charger les classes" },
      { status: 500 },
    );
  }
}

/** Crée une classe + son QR (salle) en une fois. */
export async function POST(req: Request) {
  const auth = await resolveSchoolAdmin();
  if (!auth.ok) {
    return NextResponse.json(
      { message: auth.message, code: auth.code },
      { status: auth.status },
    );
  }
  const { schoolId, userId } = auth.ctx;

  try {
    await ensureSchoolYearCurrent(schoolId);
  } catch (err) {
    if (err instanceof Error && err.message === "SCHOOL_NOT_FOUND") {
      return NextResponse.json(
        {
          message:
            "Établissement introuvable. Reconnectez-vous (admin@lycee.ga / admin123).",
          code: "SCHOOL_NOT_FOUND",
        },
        { status: 401 },
      );
    }
    console.error("[classrooms POST] school year", err);
    return NextResponse.json(
      { message: "Impossible de préparer l’année scolaire" },
      { status: 500 },
    );
  }

  try {
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
      where: { schoolId, isCurrent: true },
    });
    if (!year) {
      return NextResponse.json(
        { message: "Aucune année scolaire en cours" },
        { status: 400 },
      );
    }

    const existing = await prisma.classroom.findMany({
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
        existing.map((c) => c.name),
      );
    } catch {
      return NextResponse.json(
        {
          message:
            "Toutes les lettres A–Z sont déjà utilisées pour ce niveau",
        },
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
      meta: { name, level, roomId: room.id },
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

    let qrDataUrl = "";
    try {
      const QRCode = (await import("qrcode")).default;
      qrDataUrl = await QRCode.toDataURL(url, {
        width: 320,
        margin: 1,
        color: { dark: "#004D2E", light: "#FFFFFF" },
      });
    } catch (err) {
      console.error("[classrooms POST] qrcode", err);
    }

    return NextResponse.json(
      {
        id: classroom.id,
        name: classroom.name,
        level: classroom.level,
        notes: classroom.notes,
        studentsCount: 0,
        room: {
          id: room.id,
          code: room.code,
          publicId: room.publicId,
          isActive: room.isActive,
          url,
        },
        qrDataUrl,
      },
      { status: 201 },
    );
  } catch (err) {
    console.error("[classrooms POST]", err);
    return NextResponse.json(
      { message: "Création de la classe impossible" },
      { status: 500 },
    );
  }
}
