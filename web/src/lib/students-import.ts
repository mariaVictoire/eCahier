/** Normalise une ligne élève (CSV/JSON / formulaire). */
export function normalizeStudent(raw: {
  firstName?: unknown;
  lastName?: unknown;
  prenom?: unknown;
  nom?: unknown;
  studentCode?: unknown;
  code?: unknown;
}) {
  const firstName = String(raw.firstName ?? raw.prenom ?? "")
    .trim()
    .replace(/\s+/g, " ");
  const lastName = String(raw.lastName ?? raw.nom ?? "")
    .trim()
    .replace(/\s+/g, " ");
  const studentCode =
    String(raw.studentCode ?? raw.code ?? "").trim() || null;
  if (!firstName || !lastName) return null;
  return { firstName, lastName, studentCode };
}

/** Parse CSV (nom,prénom ou lastName,firstName) ou JSON. */
export function parseStudentsImport(text: string): {
  firstName: string;
  lastName: string;
  studentCode: string | null;
}[] {
  const trimmed = text.trim();
  if (!trimmed) return [];

  if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
    const data = JSON.parse(trimmed) as unknown;
    const list = Array.isArray(data)
      ? data
      : Array.isArray((data as { students?: unknown }).students)
        ? (data as { students: unknown[] }).students
        : null;
    if (!list) throw new Error("JSON invalide : tableau d’élèves attendu");
    return list
      .map((row) => normalizeStudent(row as Record<string, unknown>))
      .filter(Boolean) as {
      firstName: string;
      lastName: string;
      studentCode: string | null;
    }[];
  }

  const lines = trimmed.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length === 0) return [];

  const delim = lines[0].includes(";") ? ";" : ",";
  const header = lines[0].split(delim).map((h) => h.trim().toLowerCase());
  const hasHeader = header.some((h) =>
    [
      "nom",
      "lastname",
      "last_name",
      "prénom",
      "prenom",
      "firstname",
      "first_name",
    ].includes(h),
  );

  const rows = hasHeader ? lines.slice(1) : lines;
  const idxNom = hasHeader
    ? header.findIndex((h) => ["nom", "lastname", "last_name"].includes(h))
    : 0;
  const idxPrenom = hasHeader
    ? header.findIndex((h) =>
        ["prénom", "prenom", "firstname", "first_name"].includes(h),
      )
    : 1;
  const idxCode = hasHeader
    ? header.findIndex((h) =>
        ["code", "matricule", "studentcode", "student_code"].includes(h),
      )
    : -1;

  if (idxNom < 0 || idxPrenom < 0) {
    throw new Error(
      "CSV : colonnes nom et prénom (ou lastName, firstName) requises",
    );
  }

  return rows
    .map((line) => {
      const cols = line.split(delim).map((c) => c.trim().replace(/^"|"$/g, ""));
      return normalizeStudent({
        lastName: cols[idxNom],
        firstName: cols[idxPrenom],
        studentCode: idxCode >= 0 ? cols[idxCode] : undefined,
      });
    })
    .filter(Boolean) as {
    firstName: string;
    lastName: string;
    studentCode: string | null;
  }[];
}
