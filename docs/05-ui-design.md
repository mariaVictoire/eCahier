# Maquettes UI & design system — eCahier

## 1. Direction visuelle

Contexte : établissements scolaires gabonais, usage quotidien, souvent en extérieur/cour ou salle lumineuse, connexion fragile.

**Direction** : « tableau clair » — surfaces claires, accent vert forêt (référence drapeau / nature), typographie lisible, zéro fioriture.

À éviter (biais IA) : violet/indigo, cream+terracotta, mode sombre par défaut, pills partout, glow, ombres multiples.

### Tokens

| Token | Valeur | Usage |
|---|---|---|
| `--brand` | `#0B6E4F` | CTA, liens, focus |
| `--brand-ink` | `#084C37` | Titres marque |
| `--bg` | `#F7F8F6` | Fond page (léger grain CSS optionnel) |
| `--surface` | `#FFFFFF` | Zones de saisie |
| `--text` | `#1A1F1C` | Corps |
| `--muted` | `#5C6B63` | Secondaire |
| `--danger` | `#B42318` | Erreurs PIN |
| `--warn` | `#B54708` | Hors ligne / manquants |
| `--ok` | `#027A48` | Sync OK / validé |
| `--radius` | `12px` | Champs & boutons |
| `--space` | 4 px base | 8 / 12 / 16 / 24 / 40 |

### Typographie

- **Display / marque** : `Fraunces` (ou `Literata`) — nom « eCahier » hero
- **UI** : `Source Sans 3` — formulaires, listes
- Tailles : 14 / 16 / 20 / 28 / 40 ; line-height 1.45

### Motion (2–3 intentions)

1. Fade+slide 120 ms à l’ouverture du contexte créneau après scan
2. Pulse discret sur indicateur « Synchronisation… »
3. Succès validation : check scale 200 ms puis écran résumé

---

## 2. Composants clés

- **ButtonPrimary** : fond brand, hauteur 48 px mobile
- **PinPad** : clavier numérique plein écran bas (mobile)
- **SlotSummary** : liste définition (Classe / Matière / Prof) sans card lourde
- **SessionForm** : labels au-dessus, autosave hint
- **StatusChip** : En ligne / Hors ligne / Validé
- **TopBar** : marque à gauche, actions à droite
- **EmptyState** : une phrase + une action

---

## 3. Écrans maquettés (fichiers)

Les visuels générés sont dans `assets/mockups/` :

| Fichier | Écran |
|---|---|
| `01-accueil-enseignant.png` | Accueil mobile — brand + CTA scan |
| `02-pin-contexte.png` | Contexte créneau + PIN |
| `03-formulaire-seance.png` | Formulaire de saisie |
| `04-dashboard-admin.png` | Dashboard établissement desktop |

---

## 4. Accessibilité

- Contraste AA minimum
- Focus visible 2 px brand
- PIN : annonce lecteur d’écran « chiffre saisi » sans révéler la valeur
- Zones tactiles ≥ 44×44
- Mode low-bandwidth : images off, CSS critique inline

---

## 5. Responsive

| Breakpoint | Comportement |
|---|---|
| < 640 px | Flux vertical, pin pad, nav bottom enseignant |
| 640–1024 | Tablette : formulaire + contexte sticky |
| > 1024 | Admin : sidebar + grilles dashboard / EDT |
