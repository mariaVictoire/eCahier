/** Niveaux collège / lycée courants au Gabon. */
export const CLASS_LEVELS = [
  "6ème",
  "5ème",
  "4ème",
  "3ème",
  "2nde",
  "1ère",
  "Terminale",
] as const;

export type ClassLevel = (typeof CLASS_LEVELS)[number];

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

/** Rang du niveau pour le code salle : 6ème→1, 5ème→2, … Terminale→7. */
export function levelRank(level: string): number {
  const idx = (CLASS_LEVELS as readonly string[]).indexOf(level);
  return idx >= 0 ? idx + 1 : 0;
}

/**
 * Code salle auto : lettre de section + rang du niveau.
 * Ex. 6ème A → A1 · 5ème B → B2 · Terminale C → C7
 */
export function roomCodeFromLevelAndLetter(level: string, letter: string): string {
  const rank = levelRank(level);
  const section = letter.trim().toUpperCase().slice(0, 1);
  if (!rank || !/^[A-Z]$/.test(section)) {
    throw new Error("Niveau ou lettre de section invalide");
  }
  return `${section}${rank}`;
}

/** Extrait la lettre de section depuis un nom (« Terminale C7 », « 6ème A », …). */
export function sectionLetterFromClassroomName(name: string, level: string): string | null {
  const prefix = `${level} `;
  if (!name.startsWith(prefix)) return null;
  const rest = name.slice(prefix.length).trim().toUpperCase();
  const letter = rest.charAt(0);
  return /^[A-Z]$/.test(letter) ? letter : null;
}

/** Prochaine lettre libre pour un niveau donné (A, B, C…). */
export function nextSectionLetter(
  level: string,
  existingNames: string[],
): string {
  const used = new Set<string>();
  for (const name of existingNames) {
    const letter = sectionLetterFromClassroomName(name, level);
    if (letter) used.add(letter);
  }
  for (const letter of LETTERS) {
    if (!used.has(letter)) return letter;
  }
  throw new Error("Plus de lettres disponibles pour ce niveau");
}

/** Nom de classe affiché : niveau + code salle (ex. Terminale C7). */
export function classroomName(level: string, letter: string) {
  return `${level} ${roomCodeFromLevelAndLetter(level, letter)}`;
}
