import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { audit, getSession } from "@/lib/auth";

async function requireNational() {
  const session = await getSession();
  if (!session || session.role !== "national_admin") return null;
  return session;
}

function parseDay(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  return new Date(`${value}T00:00:00+01:00`);
}

export async function PUT(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await requireNational();
  if (!session) {
    return NextResponse.json({ message: "Accès refusé" }, { status: 403 });
  }

  const { id } = await ctx.params;
  const existing = await prisma.schoolHoliday.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ message: "Introuvable" }, { status: 404 });
  }

  const body = await req.json().catch(() => ({}));
  const name =
    body.name !== undefined ? String(body.name).trim() : existing.name;
  const startsOn =
    body.startsOn !== undefined
      ? parseDay(String(body.startsOn).trim())
      : existing.startsOn;
  const endsOn =
    body.endsOn !== undefined
      ? parseDay(String(body.endsOn).trim())
      : existing.endsOn;

  if (!name) {
    return NextResponse.json({ message: "Nom requis" }, { status: 400 });
  }
  if (!startsOn || !endsOn) {
    return NextResponse.json(
      { message: "Dates invalides (AAAA-MM-JJ)" },
      { status: 400 },
    );
  }
  if (endsOn < startsOn) {
    return NextResponse.json(
      { message: "La date de fin doit être après le début" },
      { status: 400 },
    );
  }

  const holiday = await prisma.schoolHoliday.update({
    where: { id },
    data: { name, startsOn, endsOn },
  });

  await audit("holiday.update", {
    actorId: session.sub,
    entityType: "school_holiday",
    entityId: holiday.id,
    meta: { name },
  });

  return NextResponse.json({
    id: holiday.id,
    yearLabel: holiday.yearLabel,
    kind: holiday.kind,
    name: holiday.name,
    startsOn: holiday.startsOn.toISOString().slice(0, 10),
    endsOn: holiday.endsOn.toISOString().slice(0, 10),
  });
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await requireNational();
  if (!session) {
    return NextResponse.json({ message: "Accès refusé" }, { status: 403 });
  }

  const { id } = await ctx.params;
  const existing = await prisma.schoolHoliday.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ message: "Introuvable" }, { status: 404 });
  }

  await prisma.schoolHoliday.delete({ where: { id } });
  await audit(
    existing.kind === "strike" ? "strike.delete" : "holiday.delete",
    {
      actorId: session.sub,
      entityType: "school_holiday",
      entityId: id,
      meta: {
        name: existing.name,
        yearLabel: existing.yearLabel,
        kind: existing.kind,
      },
    },
  );

  return NextResponse.json({ ok: true });
}
