import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { audit, getSession } from "@/lib/auth";
import { phoneDigits } from "@/lib/phone";

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
  try {
    const session = await requireAdmin();
    if (!session) {
      return NextResponse.json({ message: "Accès refusé" }, { status: 403 });
    }

    const [teachers, school] = await Promise.all([
      prisma.user.findMany({
        where: {
          schoolId: session.schoolId!,
          deletedAt: null,
          role: "teacher",
        },
        orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
        select: {
          id: true,
          firstName: true,
          lastName: true,
          phone: true,
          pinCode: true,
          isActive: true,
          createdAt: true,
          lastLoginAt: true,
        },
      }),
      prisma.school.findUnique({
        where: { id: session.schoolId! },
        select: { name: true },
      }),
    ]);

    return NextResponse.json({
      items: teachers,
      schoolName: school?.name ?? null,
    });
  } catch (err) {
    console.error("GET /api/teachers", err);
    return NextResponse.json(
      { message: "Impossible de charger les enseignants" },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ message: "Accès refusé" }, { status: 403 });
  }

  const body = await req.json();
  const firstName = String(body.firstName || "").trim();
  const lastName = String(body.lastName || "").trim();
  const phone = String(body.phone || "").trim();
  const pin = String(body.pin || "").trim();

  if (!firstName || !lastName) {
    return NextResponse.json(
      { message: "Prénom et nom obligatoires" },
      { status: 400 },
    );
  }
  if (!phone || phoneDigits(phone).length < 8) {
    return NextResponse.json(
      { message: "Numéro de téléphone obligatoire (WhatsApp)" },
      { status: 400 },
    );
  }
  if (!/^\d{4,8}$/.test(pin)) {
    return NextResponse.json(
      { message: "PIN invalide : 4 à 8 chiffres" },
      { status: 400 },
    );
  }

  const phoneKey = phoneDigits(phone);
  const peers = await prisma.user.findMany({
    where: {
      schoolId: session.schoolId!,
      role: "teacher",
      deletedAt: null,
      phone: { not: null },
    },
    select: { id: true, phone: true },
  });
  if (peers.some((p) => phoneDigits(p.phone || "") === phoneKey)) {
    return NextResponse.json(
      { message: "Un enseignant avec ce numéro existe déjà" },
      { status: 409 },
    );
  }

  const school = await prisma.school.findUnique({
    where: { id: session.schoolId! },
    select: { name: true },
  });

  const pinHash = await bcrypt.hash(pin, 10);
  const teacher = await prisma.user.create({
    data: {
      schoolId: session.schoolId!,
      role: "teacher",
      firstName,
      lastName,
      email: null,
      phone,
      pinHash,
      pinCode: pin,
      isActive: true,
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      phone: true,
      pinCode: true,
      isActive: true,
    },
  });

  await audit("teacher.create", {
    schoolId: session.schoolId,
    actorId: session.sub,
    entityType: "user",
    entityId: teacher.id,
  });

  return NextResponse.json(
    {
      ...teacher,
      schoolName: school?.name ?? null,
      temporaryPin: pin,
    },
    { status: 201 },
  );
}
