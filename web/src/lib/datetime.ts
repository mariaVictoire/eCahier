/** Fuseau et formats date/heure pour eCahier (Gabon). */
export const GABON_TZ = "Africa/Libreville";
export const FR_LOCALE = "fr-FR";

/** Africa/Libreville = UTC+1 permanent (pas d’heure d’été). */
const GABON_OFFSET = "+01:00";

function pad(n: number) {
  return String(n).padStart(2, "0");
}

export type ZonedParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  weekdayShort: string; // Mon, Tue, …
};

export function zonedParts(
  date: Date = new Date(),
  timeZone: string = GABON_TZ,
): ZonedParts {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    weekday: "short",
  }).formatToParts(date);

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value || "";

  return {
    year: Number(get("year")),
    month: Number(get("month")),
    day: Number(get("day")),
    hour: Number(get("hour")),
    minute: Number(get("minute")),
    weekdayShort: get("weekday"),
  };
}

const WEEKDAY_FROM_EN: Record<string, string> = {
  Sun: "sun",
  Mon: "mon",
  Tue: "tue",
  Wed: "wed",
  Thu: "thu",
  Fri: "fri",
  Sat: "sat",
};

/** Jour de la semaine au Gabon (mon…sun). */
export function getWeekdayGabon(date: Date = new Date()) {
  const key = zonedParts(date).weekdayShort;
  return WEEKDAY_FROM_EN[key] || "mon";
}

/** Heure courante HH:mm au Gabon (pour comparaison EDT). */
export function formatHmGabon(date: Date = new Date()) {
  const p = zonedParts(date);
  return `${pad(p.hour)}:${pad(p.minute)}`;
}

/** Affichage français d’une heure stockée « 08:30 » → « 8 h 30 ». */
export function formatHmFr(hm: string) {
  const match = /^(\d{1,2}):(\d{2})$/.exec(hm.trim());
  if (!match) return hm;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (m === 0) return `${h} h`;
  return `${h} h ${pad(m)}`;
}

export function formatHmRangeFr(startsAt: string, endsAt: string) {
  return `${formatHmFr(startsAt)} – ${formatHmFr(endsAt)}`;
}

/** Date longue en français, fuseau Gabon. */
export function formatDateLongFr(
  date: Date | string,
  timeZone: string = GABON_TZ,
) {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString(FR_LOCALE, {
    timeZone,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/** Date courte JJ/MM/AAAA (Gabon). */
export function formatDateShortFr(
  date: Date | string,
  timeZone: string = GABON_TZ,
) {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString(FR_LOCALE, { timeZone });
}

/** Date + heure françaises (Gabon), ex. « 6 août 2026 à 14 h 30 ». */
export function formatDateTimeFr(
  date: Date | string,
  timeZone: string = GABON_TZ,
) {
  const d = typeof date === "string" ? new Date(date) : date;
  const datePart = d.toLocaleDateString(FR_LOCALE, {
    timeZone,
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const timePart = d.toLocaleTimeString(FR_LOCALE, {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
    hour12: false,
  });
  // fr-FR souvent « 14:30 » → « 14 h 30 »
  const hm = timePart.replace(":", " h ").replace(/\u202f/g, " ");
  return `${datePart} à ${hm}`;
}

/**
 * Combine la date calendaire (au Gabon) avec une heure murale HH:mm
 * interprétée en heure de Libreville.
 */
export function combineDateAndTimeGabon(date: Date, hm: string) {
  const p = zonedParts(date);
  const [h, m] = hm.split(":").map(Number);
  const iso = `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(h)}:${pad(m)}:00${GABON_OFFSET}`;
  return new Date(iso);
}

/** Début de journée civile au Gabon (00:00 Libreville). */
export function startOfDayGabon(date: Date = new Date()) {
  const p = zonedParts(date);
  const iso = `${p.year}-${pad(p.month)}-${pad(p.day)}T00:00:00${GABON_OFFSET}`;
  return new Date(iso);
}
