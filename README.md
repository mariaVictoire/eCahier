# eCahier

Cahier de textes numérique pour les établissements scolaires du Gabon.

## Application web

L’app MVP est dans [`web/`](web/) (Next.js 15 + Prisma + SQLite).

```bash
cd web
npm install
npm run db:reset
npm run dev
```

Ouvrir [http://localhost:3000](http://localhost:3000)

### Comptes démo

| Profil | Identifiants |
|---|---|
| Admin établissement | `admin@lycee.ga` / `admin123` |
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

## Conception

Voir [`docs/`](docs/) pour architecture, BDD, API, roadmap, sécurité et coûts.
