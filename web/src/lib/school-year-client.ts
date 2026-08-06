/** Année de référence (sept. N → août N+1). Pas de bascule auto. */
export function currentSchoolYearLabel(now = new Date()) {
  const year = now.getFullYear();
  const month = now.getMonth() + 1; // 1–12
  const startYear = month >= 9 ? year : year - 1;
  return `${startYear}-${startYear + 1}`;
}

/** Ex. « 2025-2026 » → « 2026-2027 ». */
export function nextSchoolYearFromLabel(label: string) {
  const match = /^(\d{4})\s*[-/]\s*(\d{4})$/.exec(label.trim());
  if (!match) {
    const start = Number(currentSchoolYearLabel().slice(0, 4));
    return `${start + 1}-${start + 2}`;
  }
  const startYear = Number(match[1]) + 1;
  return `${startYear}-${startYear + 1}`;
}
