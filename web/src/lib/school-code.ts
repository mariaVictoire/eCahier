/** Génère un code établissement du type EST-LBV ou LYC-POG. */

const CITY_ALIASES: Record<string, string> = {
  libreville: "LBV",
  portgentil: "POG",
  "port-gentil": "POG",
  franceville: "FCV",
  oyem: "OYM",
  mouila: "MOU",
  lambarene: "LMB",
  tchibanga: "TCB",
  makokou: "MKK",
  koulamoutou: "KLM",
};

function stripAccents(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function compactAlpha(value: string) {
  return stripAccents(value)
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "");
}

function typePrefix(name: string) {
  const n = stripAccents(name).toLowerCase();
  if (n.includes("lycee") || n.includes("lycée")) return "LYC";
  if (n.includes("college") || n.includes("collège")) return "COL";
  if (n.includes("ecole") || n.includes("école")) return "ECO";
  if (n.includes("institut")) return "INS";
  return "EST";
}

function cityCode(city: string) {
  const key = stripAccents(city)
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[^a-z-]/g, "");
  if (CITY_ALIASES[key]) return CITY_ALIASES[key];

  const compact = compactAlpha(city);
  if (compact.length >= 3) return compact.slice(0, 3);
  if (compact.length > 0) return compact.padEnd(3, "X");
  return "XXX";
}

/** Préfixe sans numéro : LYC-LBV */
export function schoolCodePrefix(name: string, city: string) {
  return `${typePrefix(name)}-${cityCode(city)}`;
}

/** Code complet avec numéro : LYC-LBV-001 */
export function formatSchoolCode(prefix: string, sequence: number) {
  return `${prefix}-${String(sequence).padStart(3, "0")}`;
}

export function buildSchoolCodePreview(name: string, city: string) {
  if (!name.trim() || !city.trim()) return "";
  return formatSchoolCode(schoolCodePrefix(name, city), 1);
}
