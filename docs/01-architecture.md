# Architecture eCahier

## 1. Vision produit

**eCahier** numérise le cahier de textes des établissements scolaires du Gabon. Le parcours principal est volontairement minimal :

1. L’enseignant scanne le **QR code permanent de la salle**
2. Le serveur résout salle → créneau EDT → classe / matière / professeur attendu
3. L’enseignant confirme son identité avec un **PIN personnel**
4. Il complète et valide la séance

Contraintes locales prioritaires : **mobile first**, **connexion instable**, **UX ultra simple** pour des utilisateurs peu à l’aise avec l’informatique.

---

## 2. Principes d’architecture

| Principe | Décision |
|---|---|
| Offline-first | PWA + file d’attente locale (IndexedDB) + sync différée |
| Server of truth | PostgreSQL ; le QR ne contient **aucun** détail de cours |
| Moindre privilège | RBAC strict (national / établissement / enseignant) |
| Auditabilité | Journal d’actions immuable + historique des versions de séances |
| Soft delete | Aucune suppression physique des séances / devoirs |
| Idempotence | Sync offline avec `client_mutation_id` unique |
| Latence perçue | UI optimiste + sauvegarde auto locale toutes les 5–10 s |

---

## 3. Stack technologique (justifiée)

### Frontend — Next.js 15 (App Router) + TypeScript + PWA

- Un seul codebase web responsive (smartphone / tablette / desktop)
- SSR/SSG pour les écrans admin ; client components pour le flux scan/PIN
- **PWA** (Serwist / Workbox) : installation sur l’écran d’accueil, cache assets, file offline
- **TanStack Query** : cache serveur, retry, invalidation
- **Zustand** (+ persist IndexedDB) : brouillons de séance + queue de sync
- **html5-qrcode** ou BarcodeDetector API : scan QR caméra
- **Tailwind CSS** + design tokens maison : UI épurée, rapide à maintenir

*Pourquoi pas Flutter/React Native ?* Le besoin est majoritairement formulaire + consultation ; le web/PWA évite les stores, simplifie les mises à jour nationales, et fonctionne sur le parc hétérogène des enseignants.

### Backend — NestJS (Node.js) + TypeScript

- Même langage que le frontend → productivité monorepo
- Modules clairs : Auth, Schools, Rooms, Timetable, Sessions, Exports, Audit
- Validation native (`class-validator` / Zod), guards RBAC, OpenAPI auto
- Workers (BullMQ) pour PDF/Excel et notifications

*Alternative FastAPI* possible si l’équipe est Python-native ; NestJS est préféré pour cohérence TS et maturité enterprise.

### API — REST + OpenAPI 3

- REST versionné `/api/v1`
- JSON, pagination cursor, filtres standardisés
- Webhooks internes optionnels pour notifications
- OpenAPI généré → clients typés + documentation Swagger

### Base de données — PostgreSQL 16

- Relations riches (EDT, séances, rôles multi-écoles)
- Contraintes d’intégrité, partial indexes, full-text (`tsvector`) pour la recherche
- JSONB pour métadonnées extensibles (compétences, observations structurées)
- Extensions : `pgcrypto`, `uuid-ossp` / `pg_uuidv7`

### Cache / files d’attente — Redis 7

- Sessions refresh token (blacklist / rotation)
- Rate limiting PIN (anti brute-force)
- BullMQ : exports, emails/push, rappels

### Authentification

| Profil | Méthode |
|---|---|
| Admin national / établissement | Email + mot de passe + JWT (access 15 min / refresh 7 j) + MFA optionnelle |
| Enseignant (salle) | Scan QR salle → challenge PIN → JWT **scopé séance** (courte durée) |
| Enseignant (consultation) | Login email/PIN ou téléphone + PIN |

- PIN stocké **hashé** (Argon2id), jamais en clair
- QR salle = URL signée `https://app.ecahier.ga/r/{roomPublicId}?sig=…` ou token opaque ; contenu = **identifiant salle uniquement**
- Rotation possible des secrets QR sans changer l’affichage physique (mapping serveur)

### Stockage fichiers — S3-compatible (Cloudflare R2 ou MinIO)

- Pièces jointes séances (PDF, images ≤ 10 Mo)
- Exports générés
- URLs présignées, virus scan async (ClamAV worker) en phase 2

### Hébergement recommandé (phase nationale)

| Couche | Option A (coût maîtrisé) | Option B (scalable) |
|---|---|---|
| App + API | Fly.io (région `jnb` Johannesburg) ou VPS Contabo | AWS af-south-1 (Cape Town) |
| PostgreSQL | Managed (Neon / Supabase / RDS) | RDS Multi-AZ |
| Redis | Upstash / Redis Cloud | ElastiCache |
| Fichiers | Cloudflare R2 | S3 |
| CDN / DNS | Cloudflare | CloudFront |
| Monitoring | Sentry + OpenTelemetry + Uptime Kuma | CloudWatch + Sentry |

**Choix MVP** : monorepo déployé sur **Fly.io + Neon Postgres + Upstash Redis + Cloudflare R2 + Cloudflare** — coût bas, bonne latence Afrique australe, TLS et CDN inclus.

### Observabilité

- Logs structurés JSON (Pino)
- Tracing OpenTelemetry
- Sentry (frontend + backend)
- Métriques métier : taux de saisie, sync offline échouées, PIN failures

---

## 4. Vue logique des composants

```
┌─────────────────────────────────────────────────────────────┐
│                     Clients (PWA / Desktop)                 │
│  Enseignant │ Admin établissement │ Admin national          │
└──────────────┬──────────────────────┬───────────────────────┘
               │ HTTPS / REST         │ Web Push (phase 2)
┌──────────────▼──────────────────────▼───────────────────────┐
│                     API Gateway / NestJS                    │
│  Auth │ Schools │ Rooms/QR │ Timetable │ Sessions │ Search  │
│  Exports │ Notifications │ Audit │ Admin                    │
└──────┬──────────────┬───────────────┬──────────────┬────────┘
       │              │               │              │
   PostgreSQL       Redis          Object Storage   Workers
   (source vérité)  (cache/queue)  (R2/MinIO)       (PDF/Excel/Push)
```

---

## 5. Flux métier critique — « Entrée en salle »

```
Enseignant ouvre PWA
    → Scan QR (roomPublicId)
    → GET /rooms/{id}/current-slot?at=ISO8601
    → Serveur : salle + now + EDT (+ exceptions/remplacements)
    → Réponse : classe, matière, professeurAttendu, créneau, flags
    → UI affiche le contexte (lecture seule) + champ PIN
    → POST /auth/pin { roomId, pin, slotId }
    → Si OK : JWT scoped + ouverture formulaire séance
    → Autosave local → POST /sessions (ou PATCH)
    → Signature numérique + validation → status=validated
```

Règles de résolution EDT :

1. Créneau nominal de la salle à `now ± tolérance` (ex. ±15 min)
2. Remplacement / permutation / autorisation exceptionnelle prioritaire
3. Si ambiguïté : l’enseignant choisit parmi 2–3 créneaux candidats (fallback UX)
4. Si aucun créneau : mode « séance hors EDT » réservé admin ou avec motif + validation admin

---

## 6. Mode hors-ligne

| Donnée | Offline |
|---|---|
| Assets UI | Cache PWA |
| Contexte salle déjà scannée | Cache court (TTL) |
| Brouillon séance | IndexedDB |
| Mutations | Queue FIFO + `client_mutation_id` |
| Sync | Au retour réseau, replay ordonné |
| Conflits | Last-write-wins sur brouillon ; **interdiction** d’écraser une séance `validated` sans nouvel événement d’audit |

Indicateur UI permanent : « En ligne / Hors ligne / Synchronisation… ».

---

## 7. Monorepo proposé

```
eCahier/
├── apps/
│   ├── web/                 # Next.js PWA
│   └── api/                 # NestJS
├── packages/
│   ├── shared/              # Zod schemas, types, constants
│   ├── eslint-config/
│   └── tsconfig/
├── docs/                    # Conception (ce dossier)
├── infra/                   # Terraform / Fly / Docker Compose
└── README.md
```

Outils : pnpm workspaces, Turborepo, Docker Compose (Postgres + Redis + MinIO) pour le local.

---

## 8. Environnements

| Env | Usage |
|---|---|
| `local` | Docker Compose |
| `staging` | Données anonymisées, QR de test |
| `production` | Multi-tenant par établissement |

Isolation multi-tenant : `school_id` sur presque toutes les tables + RLS PostgreSQL (phase 2) ou filtres obligatoires dans les repositories.

---

## 9. Non-objectifs MVP

- Application native stores
- Messagerie parents / élèves
- Notation / bulletins
- Visio ou présence biométrique
- IA de rédaction de leçons (évolution possible)
