/** Calendar helpers for EDT month/week navigation (weeks start on Monday). */

export function toDateKey(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function parseDateKey(key: string) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d, 12, 0, 0, 0);
}

export function startOfWeekMonday(date: Date) {
  const d = new Date(date);
  d.setHours(12, 0, 0, 0);
  const day = d.getDay(); // 0 Sun .. 6 Sat
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

export function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export function monthValue(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function parseMonthValue(value: string) {
  const [y, m] = value.split("-").map(Number);
  return { year: y, month: m }; // month 1-12
}

export type WeekOption = {
  weekStartKey: string;
  label: string;
  shortLabel: string;
};

/** Weeks (Mon–Sun) that overlap the given calendar month. */
export function weeksInMonth(year: number, month: number): WeekOption[] {
  const first = new Date(year, month - 1, 1, 12, 0, 0, 0);
  const last = new Date(year, month, 0, 12, 0, 0, 0);
  let cursor = startOfWeekMonday(first);
  // if Monday is after the 1st and in previous month, we still include it if week overlaps
  const weeks: WeekOption[] = [];
  const seen = new Set<string>();

  while (cursor <= last || weeks.length === 0) {
    const weekEnd = addDays(cursor, 6);
    const overlaps =
      (cursor >= first && cursor <= last) ||
      (weekEnd >= first && weekEnd <= last) ||
      (cursor <= first && weekEnd >= last);

    if (overlaps) {
      const key = toDateKey(cursor);
      if (!seen.has(key)) {
        seen.add(key);
        weeks.push({
          weekStartKey: key,
          label: formatWeekRange(cursor, weekEnd),
          shortLabel: formatWeekRange(cursor, weekEnd),
        });
      }
    }

    cursor = addDays(cursor, 7);
    if (cursor > addDays(last, 7)) break;
    if (weeks.length > 6) break;
  }

  return weeks;
}

/** Ex. « du 3 au 9 août 2026 » ou « du 28 juillet au 3 août 2026 ». */
export function formatWeekRange(weekStart: Date, weekEnd: Date) {
  const sameMonth =
    weekStart.getMonth() === weekEnd.getMonth() &&
    weekStart.getFullYear() === weekEnd.getFullYear();
  const sameYear = weekStart.getFullYear() === weekEnd.getFullYear();

  if (sameMonth) {
    const monthYear = weekEnd.toLocaleDateString("fr-FR", {
      month: "long",
      year: "numeric",
    });
    return `du ${weekStart.getDate()} au ${weekEnd.getDate()} ${monthYear}`;
  }

  if (sameYear) {
    const start = weekStart.toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "long",
    });
    const end = weekEnd.toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
    return `du ${start} au ${end}`;
  }

  const start = weekStart.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const end = weekEnd.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  return `du ${start} au ${end}`;
}

const WEEKDAY_INDEX: Record<string, number> = {
  mon: 0,
  tue: 1,
  wed: 2,
  thu: 3,
  fri: 4,
  sat: 5,
  sun: 6,
};

export function dateForWeekday(weekStartMonday: Date, weekday: string) {
  const idx = WEEKDAY_INDEX[weekday] ?? 0;
  return addDays(weekStartMonday, idx);
}

export function formatDayHeading(date: Date) {
  return date.toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}
