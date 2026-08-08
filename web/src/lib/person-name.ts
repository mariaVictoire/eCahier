/** Affichage court : 1er prénom + 1er nom (évite les noms trop longs à l’écran). */
export function shortDisplayName(u: { firstName: string; lastName: string }) {
  const first = u.firstName.trim().split(/\s+/)[0] || "";
  const last = u.lastName.trim().split(/\s+/)[0] || "";
  return `${first} ${last}`.trim();
}

/** Nom complet (admin, exports, documents). */
export function fullDisplayName(u: { firstName: string; lastName: string }) {
  return `${u.firstName} ${u.lastName}`.trim();
}
