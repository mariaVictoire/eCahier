# Sécurité — eCahier

## 1. Menaces prioritaires

| Menace | Impact | Mitigation |
|---|---|---|
| Brute-force PIN | Usurpation séance | Argon2id, rate limit Redis, lockout progressif, alerte admin |
| QR falsifié / rejoué | Saisie mauvaise salle | `publicId` opaque + signature HMAC serveur, pas de données cours dans le QR |
| Élévation de privilèges | Fuite cahiers | RBAC guards NestJS + tests d’authz + `school_id` obligatoire |
| Perte de données offline | Cours non synchronisés | Queue durable IndexedDB + retry + indicateur sync |
| Suppression accidentelle | Trous pédagogiques | Soft delete + motif + audit ; pas de hard delete UI |
| Fuite pièces jointes | Données élèves | URLs présignées courtes, bucket privé, scan antivirus (phase 2) |
| Admin compromis | Contrôle établissement | MFA admin, sessions courtes, audit national |
| Connexion non TLS | Interception | HTTPS only (Cloudflare), HSTS |

---

## 2. Authentification & secrets

- Mots de passe admin : Argon2id (memory ≥ 64 Mo)
- PIN enseignant : 6 chiffres min (configurable), hash Argon2id, **jamais** loggé
- JWT access 15 min (admin) / ≤ 2 h (scopé salle) ; refresh rotatif
- Secrets dans un vault / variables d’environnement chiffrées CI
- Rotation QR : nouveau secret serveur sans réimprimer si `publicId` stable
- Chiffrement au repos : Postgres managed encryption + R2 encryption
- Champs sensibles (PIN hashes, tokens) exclus des backups logs applicatifs

---

## 3. Autorisations

- Guard global JWT + decorator `@Roles()`
- Scopes token salle : écriture limitée à `slotId` / `sessionId` liés
- Admin national : pas d’accès écriture aux séances sauf impersonation audité (feature flag)
- Tests automatiques matrix RBAC sur chaque endpoint sensible

---

## 4. Audit & non-répudiation

Journaliser au minimum :
- login succès/échec, PIN succès/échec/lock
- create/update/validate/delete séance
- reset PIN, rotation QR
- exceptions EDT
- exports

Signature numérique séance = `HMAC(serverSecret, sessionId|teacherId|validatedAt|contentHash)` + preuve que le PIN a été revalidé à la signature (sans stocker le PIN).

Versions JSONB : historique consultable, restauration admin.

---

## 5. Durcissement applicatif

- Helmet, CORS strict, rate limit global + spécifique `/auth/pin`
- Validation Zod/DTO stricte, limite taille body/uploads
- Protection CSRF non nécessaire pour API Bearer pure ; cookies refresh : `HttpOnly` `Secure` `SameSite=Strict`
- WAF Cloudflare (SQLi/XSS basiques)
- Dépendances : Dependabot / Renovate + CI audit

---

## 6. Sauvegardes

| Ressource | RPO | RTO | Méthode |
|---|---|---|---|
| PostgreSQL | ≤ 1 h | ≤ 4 h | PITR + snapshots quotidiens 30 j |
| R2 fichiers | ≤ 24 h | ≤ 8 h | Versioning bucket |
| Secrets | — | — | Backup vault hors bande |

Test de restauration **trimestriel**.

---

## 7. Conformité & vie privée

- Minimiser données élèves dans les pièces jointes (consignes UX)
- Politique de rétention : séances ≥ 5 ans scolaires (paramétrable)
- Droit d’accès admin établissement ; export personnel enseignant sur demande
- Journal d’accès aux exports massifs

---

## 8. Checklist go-live sécurité

- [ ] TLS + HSTS
- [ ] Rate limit PIN validé
- [ ] Backup/restore testé
- [ ] RBAC e2e vert
- [ ] Sentry sans PII (scrubbing)
- [ ] Revue des secrets CI
- [ ] PDF QR sans données personnelles
- [ ] Politique soft delete documentée pour les chefs d’établissement
