import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureSchoolYearCurrent } from "@/lib/school-year";

/**
 * Endpoint optionnel : s’assure qu’une année courante existe
 * (pas de bascule calendaire automatique).
 * Header : Authorization: Bearer <CRON_SECRET>
 */
export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { message: "CRON_SECRET non configuré" },
      { status: 503 },
    );
  }

  const auth = req.headers.get("authorization") || "";
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ message: "Non autorisé" }, { status: 401 });
  }

  const schools = await prisma.school.findMany({
    select: { id: true, name: true },
  });
  const results = [];

  for (const school of schools) {
    const result = await ensureSchoolYearCurrent(school.id);
    results.push({
      schoolId: school.id,
      schoolName: school.name,
      ...result,
    });
  }

  return NextResponse.json({
    ok: true,
    processed: results.length,
    changed: results.filter((r) => r.changed).length,
    results,
  });
}
