import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { audit, getSession } from "@/lib/auth";
import { currentSchoolYearBounds } from "@/lib/school-year";

async function requireNational() {
  const session = await getSession();
  if (!session || session.role !== "national_admin") return null;
  return session;
}

function parseDay(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  return new Date(`${value}T00:00:00+01:00`);
}

function parseKind(value: unknown): "holiday" | "strike" | null {
  const k = String(value || "holiday").trim();
  if (k === "holiday" || k === "strike") return k;
  return null;
}

function serialize(h: {
  id: string;
  yearLabel: string;
  kind: string;
  name: string;
  startsOn: Date;
  endsOn: Date;
}) {
  return {
    id: h.id,
    yearLabel: h.yearLabel,
    kind: h.kind,
    name: h.name,
    startsOn: h.startsOn.toISOString().slice(0, 10),
    endsOn: h.endsOn.toISOString().slice(0, 10),
  };
}

export async function GET(req: Request) {
  const session = await requireNational();
  if (!session) {
    return NextResponse.json({ message: "Accès refusé" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const yearLabel =
    searchParams.get("yearLabel")?.trim() || currentSchoolYearBounds().label;
  const kindFilter = searchParams.get("kind");

  const holidays = await prisma.schoolHoliday.findMany({
    where: {
      yearLabel,
      ...(kindFilter === "holiday" || kindFilter === "strike"
        ? { kind: kindFilter }
        : {}),
    },
    orderBy: [{ kind: "asc" }, { startsOn: "asc" }],
  });

  return NextResponse.json({
    yearLabel,
    holidays: holidays.map(serialize),
  });
}

export async function POST(req: Request) {
  const session = await requireNational();
  if (!session) {
    return NextResponse.json({ message: "Accès refusé" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const yearLabel =
    String(body.yearLabel || "").trim() || currentSchoolYearBounds().label;
  const kind = parseKind(body.kind);
  const name = String(body.name || "").trim();
  const startsOn = parseDay(String(body.startsOn || "").trim());
  const endsOn = parseDay(String(body.endsOn || "").trim());

  if (!kind) {
    return NextResponse.json(
      { message: "Type invalide (holiday | strike)" },
      { status: 400 },
    );
  }
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

  const holiday = await prisma.schoolHoliday.create({
    data: { yearLabel, kind, name, startsOn, endsOn },
  });

  await audit(kind === "strike" ? "strike.create" : "holiday.create", {
    actorId: session.sub,
    entityType: "school_holiday",
    entityId: holiday.id,
    meta: { yearLabel, name, kind },
  });

  return NextResponse.json(serialize(holiday));
}
