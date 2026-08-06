# eCahier

Cahier de textes numérique pour les établissements scolaires du Gabon.

## Application web

L’app MVP est dans [`web/`](web/) (Next.js 15 + Prisma + **PostgreSQL** / Neon).

```bash
cd web
cp .env.example .env
# Renseigner DATABASE_URL (Neon), AUTH_SECRET, NEXT_PUBLIC_APP_URL
npm install
npm run db:reset
npm run dev
```

Ouvrir [http://localhost:3000](http://localhost:3000)

### Comptes démo

| Profil | Identifiants |
|---|---|
| Admin établissement | `admin@lycee.ga` / `admin123` |
| Admin national | `national@ecahier.ga` / `national123` |
| Enseignant | email `obame@lycee.ga` + PIN `123456` |
| Salle démo | [Salle B12](http://localhost:3000/room/rm_b12_demo) |

### Parcours enseignant

1. Accueil → **Scanner la salle** (ou démo B12)
2. Vérifier classe / matière / horaire
3. Saisir le **PIN** `123456`
4. Remplir et **valider** la séance

### Parcours admin

1. **Me connecter** → dashboard
2. Salles & QR, équipe, classes, EDT, exports PDF

---

## Déploiement Vercel (v1)

1. Pousser le code sur GitHub (`main`).
2. Sur [vercel.com](https://vercel.com) : **Import** du repo `eCahier`.
3. **Root Directory** : `web` (important).
4. Créer une base **Neon** (intégration Vercel ou [neon.tech](https://neon.tech)) et copier `DATABASE_URL`.
5. Variables d’environnement (Production) :
   - `DATABASE_URL` — chaîne Neon (`?sslmode=require`)
   - `AUTH_SECRET` — secret aléatoire long
   - `NEXT_PUBLIC_APP_URL` — `https://<projet>.vercel.app`
6. Deploy. Le build exécute `prisma db push` puis `next build`.
7. Seed une fois (depuis `web/`, avec `DATABASE_URL` de prod) :
   ```bash
   npm run db:seed
   ```

---

## Conception

Voir [`docs/`](docs/) pour architecture, BDD, API, roadmap, sécurité et coûts.
