import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { audit, getSession } from "@/lib/auth";
import { formatSchoolCode, schoolCodePrefix } from "@/lib/school-code";
import { currentSchoolYearBounds } from "@/lib/school-year";

async function requireNational() {
  const session = await getSession();
  if (!session || session.role !== "national_admin") return null;
  return session;
}

async function nextSchoolCode(name: string, city: string) {
  const prefix = schoolCodePrefix(name, city);
  const existing = await prisma.school.findMany({
    where: { code: { startsWith: `${prefix}-` } },
    select: { code: true },
  });

  let max = 0;
  for (const row of existing) {
    const match = /-(\d+)$/.exec(row.code);
    if (match) max = Math.max(max, Number(match[1]));
  }

  return formatSchoolCode(prefix, max + 1);
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
  const name = String(body.name || "").trim();
  const city = String(body.city || "").trim();

  const adminEmail = String(body.adminEmail || "")
    .trim()
    .toLowerCase();
  const adminFirstName = String(body.adminFirstName || "").trim();
  const adminLastName = String(body.adminLastName || "").trim();
  const adminPassword = String(body.adminPassword || "").trim();

  if (!name || !city) {
    return NextResponse.json(
      { message: "Nom et ville de l’établissement requis" },
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

  const code = await nextSchoolCode(name, city);

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
  const schoolYear = currentSchoolYearBounds();

  const created = await prisma.$transaction(async (tx) => {
    const school = await tx.school.create({
      data: { code, name, city },
    });

    await tx.schoolYear.create({
      data: {
        schoolId: school.id,
        label: schoolYear.label,
        startsOn: schoolYear.startsOn,
        endsOn: schoolYear.endsOn,
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
