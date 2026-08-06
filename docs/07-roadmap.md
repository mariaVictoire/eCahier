# Roadmap, MVP & évolutions — eCahier

## 1. Phases de développement

### Phase 0 — Fondations (2 semaines)
- Monorepo pnpm/Turborepo, Docker Compose
- Auth admin + modèle User/School
- CI (lint, test, build), environnements staging
- Design system UI de base

### Phase 1 — MVP établissement pilote (6–8 semaines)
**Objectif** : un lycée pilote remplace le cahier papier pour les séances du jour.

Livré :
- Admin école : enseignants + PIN, classes, salles, QR, matières
- EDT hebdomadaire simple
- Flux scan QR → PIN → formulaire séance → validation
- Autosave + mode offline basique (brouillon local)
- Historique enseignant (liste + filtres classe/matière/date)
- Dashboard école (faits / manquants du jour)
- Export PDF cahier d’une classe (période)
- Audit minimal (validate, pin fail, CRUD users)

### Phase 2 — Exploitation réelle (4–6 semaines)
- Exceptions EDT : remplacement, permutation, annulation, autorisation
- Devoirs : liste à rendre / historique
- Recherche globale
- Notifications in-app (cours non renseignés, changements EDT)
- Export Excel
- Pièces jointes
- Versions de séances + soft delete
- Sync offline robuste (`/sync/push`)

### Phase 3 — National (6–8 semaines)
- Admin national multi-écoles
- Onboarding établissements
- Dashboard national
- Web Push + emails de rappel
- Partitioning / perf séances
- MFA admins, RLS Postgres
- Formation + kit impression QR

### Phase 4 — Évolutions (backlog)
- Application parents (consultation devoirs)
- Présences liées à la séance
- Templates de leçons / banque de progressions
- IA d’aide à la rédaction (opt-in)
- Applis natives si besoin parc offline extrême
- Intégration SI nationaux (si API ministère)

---

## 2. MVP — périmètre fonctionnel détaillé

| Fonction | MVP | Phase 2+ |
|---|---|---|
| QR salle permanent | Oui | Rotation secret |
| Résolution EDT auto | Oui | Exceptions avancées |
| PIN enseignant | Oui | Bio/WebAuthn optionnel |
| Saisie séance complète | Oui (champs listés) | Compétences structurées référentiel |
| Signature + heure validation | Oui | — |
| Historique perso | Oui | — |
| Dashboard école | Oui | National |
| Notifications | Non (badge manquants dashboard) | Oui |
| Recherche | Filtre liste | Full-text globale |
| PDF | Oui classe | Excel, multi-formats |
| Offline | Brouillon | Queue sync complète |
| Remplacements | Non | Oui |
| Pièces jointes | Non | Oui |

---

## 3. Plan d’équipe indicatif

| Rôle | Charge MVP |
|---|---|
| Tech lead / architecte | 0.5 |
| Backend NestJS | 1.5 |
| Frontend Next.js | 1.5 |
| UX/UI | 0.5 |
| QA | 0.5 |
| DevOps | 0.25 |

Durée calendaire MVP : **≈ 2 mois** après kickoff, avec 1 établissement pilote.

---

## 4. Jalons de recette pilote

1. 100 % des salles équipées QR imprimés
2. EDT importé / saisi pour la semaine
3. ≥ 80 % des séances du jour saisies pendant 2 semaines
4. Export PDF validé par le chef d’établissement
5. Zéro perte de brouillon sur bascule offline simulée
