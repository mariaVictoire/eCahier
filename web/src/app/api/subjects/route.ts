import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { audit, getSession } from "@/lib/auth";

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

function codeFromName(name: string) {
  const base = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "")
    .toUpperCase()
    .slice(0, 8);
  return base || "MAT";
}

export async function GET() {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ message: "Accès refusé" }, { status: 403 });
  }

  const items = await prisma.subject.findMany({
    where: { schoolId: session.schoolId! },
    orderBy: { name: "asc" },
    select: { id: true, name: true, code: true },
  });

  return NextResponse.json({ items });
}

export async function POST(req: Request) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ message: "Accès refusé" }, { status: 403 });
  }

  const body = await req.json();
  const name = String(body.name || "").trim();
  if (!name) {
    return NextResponse.json(
      { message: "Indiquez le nom de la matière" },
      { status: 400 },
    );
  }

  let code = String(body.code || "").trim().toUpperCase() || codeFromName(name);

  const existingName = await prisma.subject.findFirst({
    where: {
      schoolId: session.schoolId!,
      name: { equals: name },
    },
  });
  if (existingName) {
    return NextResponse.json(
      { message: "Cette matière existe déjà", item: existingName },
      { status: 409 },
    );
  }

  let attempt = code;
  let n = 2;
  while (
    await prisma.subject.findFirst({
      where: { schoolId: session.schoolId!, code: attempt },
    })
  ) {
    attempt = `${code.slice(0, 6)}${n}`.toUpperCase();
    n += 1;
    if (n > 99) {
      return NextResponse.json(
        { message: "Impossible de générer un code matière" },
        { status: 409 },
      );
    }
  }
  code = attempt;

  const subject = await prisma.subject.create({
    data: {
      schoolId: session.schoolId!,
      name,
      code,
    },
    select: { id: true, name: true, code: true },
  });

  await audit("subject.create", {
    schoolId: session.schoolId,
    actorId: session.sub,
    entityType: "subject",
    entityId: subject.id,
    meta: { name, code },
  });

  return NextResponse.json(subject, { status: 201 });
}
