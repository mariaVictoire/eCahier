import { prisma } from "@/lib/prisma";
import { startOfDayGabon } from "@/lib/datetime";
import { currentSchoolYearBounds } from "@/lib/school-year";

export type HolidayPeriod = {
  kind: string;
  name: string;
  startsOn: Date;
  endsOn: Date;
};

export async function loadHolidayPeriods(at: Date = new Date()) {
  const { label } = currentSchoolYearBounds(at);
  return prisma.schoolHoliday.findMany({
    where: { yearLabel: label },
    select: { kind: true, name: true, startsOn: true, endsOn: true },
  });
}

export function closedPeriodForDay(
  at: Date,
  periods: HolidayPeriod[],
): HolidayPeriod | null {
  const t = startOfDayGabon(at).getTime();
  for (const p of periods) {
    if (p.startsOn.getTime() <= t && p.endsOn.getTime() >= t) return p;
  }
  return null;
}

/** Jour calendaire fermé (vacances ou grève nationale). */
export async function isClosedSchoolDay(at: Date): Promise<{
  closed: boolean;
  reason?: string;
}> {
  const periods = await loadHolidayPeriods(at);
  const period = closedPeriodForDay(at, periods);
  if (!period) return { closed: false };
  return {
    closed: true,
    reason:
      period.kind === "strike"
        ? `Jour de grève : ${period.name}`
        : `Vacances : ${period.name}`,
  };
}
