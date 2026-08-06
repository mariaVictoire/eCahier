import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { audit, getSession } from "@/lib/auth";

async function requireNational() {
  const session = await getSession();
  if (!session || session.role !== "national_admin") return null;
  return session;
}

export async function GET() {
  const session = await requireNational();
  if (!session) {
    return NextResponse.json({ message: "Accès refusé" }, { status: 403 });
  }

  const schools = await prisma.school.findMany({
    orderBy: [{ city: "asc" }, { name: "asc" }],
    include: {
      users: {
        where: { role: "school_admin", deletedAt: null },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          isActive: true,
        },
        orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      },
      schoolYears: {
        where: { isCurrent: true },
        select: { id: true, label: true },
        take: 1,
      },
      _count: {
        select: {
          classrooms: true,
          rooms: true,
          users: true,
        },
      },
    },
  });

  return NextResponse.json({
    schools: schools.map((s) => ({
      id: s.id,
      code: s.code,
      name: s.name,
      city: s.city,
      createdAt: s.createdAt,
      schoolYear: s.schoolYears[0]?.label || null,
      admins: s.users,
      counts: {
        classrooms: s._count.classrooms,
        rooms: s._count.rooms,
        users: s._count.users,
      },
    })),
  });
}

export async function POST(req: Request) {
  const session = await requireNational();
  if (!session) {
    return NextResponse.json({ message: "Accès refusé" }, { status: 403 });
  }

  const body = await req.json();
  const code = String(body.code || "")
    .trim()
    .toUpperCase();
  const name = String(body.name || "").trim();
  const city = String(body.city || "").trim() || null;
  const yearLabel = String(body.schoolYearLabel || "2025-2026").trim();

  const adminEmail = String(body.adminEmail || "")
    .trim()
    .toLowerCase();
  const adminFirstName = String(body.adminFirstName || "").trim();
  const adminLastName = String(body.adminLastName || "").trim();
  const adminPassword = String(body.adminPassword || "").trim();

  if (!code || !name) {
    return NextResponse.json(
      { message: "Code et nom de l’établissement requis" },
      { status: 400 },
    );
  }
  if (!adminEmail || !adminFirstName || !adminLastName || !adminPassword) {
    return NextResponse.json(
      { message: "Compte direction incomplet" },
      { status: 400 },
    );
  }
  if (adminPassword.length < 6) {
    return NextResponse.json(
      { message: "Mot de passe direction : 6 caractères minimum" },
      { status: 400 },
    );
  }

  const existingSchool = await prisma.school.findUnique({ where: { code } });
  if (existingSchool) {
    return NextResponse.json(
      { message: "Ce code établissement existe déjà" },
      { status: 409 },
    );
  }

  const existingUser = await prisma.user.findFirst({
    where: { email: adminEmail, deletedAt: null },
  });
  if (existingUser) {
    return NextResponse.json(
      { message: "Cet e-mail direction est déjà utilisé" },
      { status: 409 },
    );
  }

  const passwordHash = await bcrypt.hash(adminPassword, 10);
  const now = new Date();
  const yearStart = new Date(`${yearLabel.split("-")[0]}-09-01T00:00:00+01:00`);
  const yearEnd = new Date(`${yearLabel.split("-")[1] || "2026"}-07-15T00:00:00+01:00`);

  const created = await prisma.$transaction(async (tx) => {
    const school = await tx.school.create({
      data: { code, name, city },
    });

    await tx.schoolYear.create({
      data: {
        schoolId: school.id,
        label: yearLabel,
        startsOn: Number.isNaN(yearStart.getTime())
          ? new Date(now.getFullYear(), 8, 1)
          : yearStart,
        endsOn: Number.isNaN(yearEnd.getTime())
          ? new Date(now.getFullYear() + 1, 6, 15)
          : yearEnd,
        isCurrent: true,
      },
    });

    const admin = await tx.user.create({
      data: {
        schoolId: school.id,
        role: "school_admin",
        email: adminEmail,
        firstName: adminFirstName,
        lastName: adminLastName,
        passwordHash,
        isActive: true,
      },
    });

    return { school, admin };
  });

  await audit("school.create", {
    schoolId: created.school.id,
    actorId: session.sub,
    entityType: "school",
    entityId: created.school.id,
    meta: { code, name },
  });

  return NextResponse.json(
    {
      school: {
        id: created.school.id,
        code: created.school.code,
        name: created.school.name,
        city: created.school.city,
      },
      admin: {
        id: created.admin.id,
        email: created.admin.email,
        firstName: created.admin.firstName,
        lastName: created.admin.lastName,
      },
    },
    { status: 201 },
  );
}
