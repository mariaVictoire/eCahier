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

/** Prochaine lettre libre pour un niveau donné (A, B, C…). */
export function nextSectionLetter(
  level: string,
  existingNames: string[],
): string {
  const used = new Set<string>();
  const prefix = `${level} `;
  for (const name of existingNames) {
    if (!name.startsWith(prefix) || name.length !== prefix.length + 1) continue;
    const letter = name.slice(prefix.length).toUpperCase();
    if (/^[A-Z]$/.test(letter)) used.add(letter);
  }
  for (const letter of LETTERS) {
    if (!used.has(letter)) return letter;
  }
  throw new Error("Plus de lettres disponibles pour ce niveau");
}

export function classroomName(level: string, letter: string) {
  return `${level} ${letter}`;
}
