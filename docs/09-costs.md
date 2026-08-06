# Estimations de charge et de coûts — eCahier

Hypothèses : Franc CFA (XAF) et EUR approximatifs (1 EUR ≈ 655 XAF). Prix cloud indicatifs 2026, à recalibrer au devis.

---

## 1. Charge de développement

| Phase | Effort (j-h) | Calendrier |
|---|---|---|
| Phase 0 Fondations | 40 | 2 sem. |
| Phase 1 MVP | 180 | 6–8 sem. |
| Phase 2 Exploitation | 120 | 4–6 sem. |
| Phase 3 National | 140 | 6–8 sem. |
| **Total v1 nationale** | **≈ 480 j-h** | **≈ 5–6 mois** |

Coût RH indicatif (équipe mixte Afrique Centrale / remote) :
- TJM moyen chargé 150–250 EUR → **72 k–120 k EUR** pour v1
- Ou forfait projet startup locale : **45–90 M XAF** selon seniorité

---

## 2. Coûts d’infrastructure mensuels

### Pilote (1–5 établissements, < 500 enseignants)

| Poste | Service | USD/mois | XAF/mois ≈ |
|---|---|---|---|
| App + API | Fly.io (2 shared) | 15–30 | 10–20 k |
| PostgreSQL | Neon Pro | 20–40 | 13–26 k |
| Redis | Upstash | 0–10 | 0–7 k |
| Fichiers | Cloudflare R2 | 0–5 | 0–3 k |
| CDN/DNS/WAF | Cloudflare | 0–20 | 0–13 k |
| Email | Resend / SES | 0–10 | 0–7 k |
| Monitoring | Sentry Team | 25 | 16 k |
| **Total pilote** | | **≈ 60–140** | **≈ 40–90 k** |

### National (200 établissements, ~8k enseignants, ~2k saisie/jour pic)

| Poste | Dimensionnement | USD/mois |
|---|---|---|
| API (autoscaling) | 2–4 instances | 80–200 |
| Web | CDN + edge | 20–50 |
| PostgreSQL HA | 4–8 GB RAM, replicas | 120–350 |
| Redis | 1 GB | 30–60 |
| Stockage + egress | 500 Go–2 To | 20–80 |
| Workers exports | burst | 20–50 |
| Observabilité | Sentry + logs | 50–120 |
| **Total national** | | **≈ 340–910 USD/mois** |
| | | **≈ 0,22–0,60 M XAF/mois** |

Réserve recommandée : **+30 %** pour pics de rentrée.

---

## 3. Coûts hors cloud

| Poste | Estimation |
|---|---|
| Impression QR (PVC A5 × N salles) | 500–1500 XAF / salle |
| Formation chefs d’établissement | 1–2 j / école |
| Support N1 local | 0.5–1 ETP / 50 écoles |
| Domaine + boîtes mail | négligeable |

---

## 4. Capacité & performance cibles

| Métrique | Cible MVP | Cible national |
|---|---|---|
| p95 API lecture créneau | < 300 ms | < 400 ms |
| p95 validation séance | < 500 ms | < 600 ms |
| Dispo mensuelle | 99.5 % | 99.9 % |
| Sync offline reprise | < 30 s au retour réseau | idem |
| Concurrence pic (08:00) | 50 req/s | 500 req/s |

Dimensionnement 08:00 : beaucoup d’enseignants scannent en même temps → cache Redis du créneau courant par salle (TTL 60 s) + index EDT.

---

## 5. Modèle économique suggéré (hors scope build)

- Subvention ministère / projet digitalisation
- Abonnement établissement annuel (hébergement + support)
- Grille selon effectif (ex. < 500 / < 1500 / illimité élèves)

Le build open-core (code établissement) + SaaS national reste compatible avec une gouvernance publique.
