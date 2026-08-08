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

/** Initiale du niveau pour le code salle : 6ème→6 … Terminale→T. */
export function levelCodeInitial(level: string): string {
  switch (level) {
    case "6ème":
      return "6";
    case "5ème":
      return "5";
    case "4ème":
      return "4";
    case "3ème":
      return "3";
    case "2nde":
      return "2";
    case "1ère":
      return "1";
    case "Terminale":
      return "T";
    default:
      return "";
  }
}

/** @deprecated Prefer levelCodeInitial — conservé pour compat. */
export function levelRank(level: string): number {
  const idx = (CLASS_LEVELS as readonly string[]).indexOf(level);
  return idx >= 0 ? idx + 1 : 0;
}

/**
 * Code salle : initiale du niveau + lettre de section.
 * Ex. 6ème B → 6B · Terminale C → TC · 1ère A → 1A
 */
export function roomCodeFromLevelAndLetter(level: string, letter: string): string {
  const initial = levelCodeInitial(level);
  const section = letter.trim().toUpperCase().slice(0, 1);
  if (!initial || !/^[A-Z]$/.test(section)) {
    throw new Error("Niveau ou lettre de section invalide");
  }
  return `${initial}${section}`;
}

/** Extrait la lettre de section depuis un nom (« Terminale C », « 6ème A », …). */
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

/** Nom de classe : niveau + lettre (ex. Terminale C, 6ème B). */
export function classroomName(level: string, letter: string) {
  return `${level} ${letter.trim().toUpperCase().slice(0, 1)}`;
}
