import {
  formatDateLongFr,
  formatDateShortFr,
} from "./datetime";

export function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export function formatDateFr(date: Date | string) {
  return formatDateLongFr(date);
}

export function formatShortDate(date: Date | string) {
  return formatDateShortFr(date);
}
