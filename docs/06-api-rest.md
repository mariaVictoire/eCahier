# API REST — eCahier (`/api/v1`)

Convention : JSON UTF-8, dates ISO-8601, UUID, erreurs `{ "code", "message", "details?" }`, pagination cursor `{ items, nextCursor }`.

Auth : `Authorization: Bearer <access_token>`.

---

## 1. Authentification

### `POST /auth/login`
Login admin / enseignant (consultation).

```json
{ "email": "admin@lycee.ga", "password": "…" }
```
→ `{ accessToken, refreshToken, user }`

### `POST /auth/refresh`
```json
{ "refreshToken": "…" }
```

### `POST /auth/logout`
Invalide le refresh (Redis blacklist).

### `POST /auth/pin` — confirmation identité en salle
```json
{
  "roomPublicId": "rm_8f3a…",
  "pin": "482913",
  "slotId": "uuid",
  "clientTime": "2026-07-28T08:05:00+01:00"
}
```
→ JWT **scopé** : `schoolId`, `teacherId`, `slotId`, `roomId`, `exp` court (ex. 2 h)

Erreurs : `PIN_INVALID`, `PIN_LOCKED`, `SLOT_NOT_AUTHORIZED`, `OUTSIDE_WINDOW`

### `POST /auth/change-pin`
Réservé admin (pour un enseignant) ou self-service après login.

---

## 2. Salles & contexte créneau

### `GET /rooms/:publicId`
Métadonnées salle (sans EDT).

### `GET /rooms/:publicId/current-slot?at=`
Résolution automatique.

**200**
```json
{
  "room": { "id": "…", "code": "B12", "label": "Salle B12" },
  "resolvedAt": "2026-07-28T08:05:12+01:00",
  "slot": {
    "id": "…",
    "classroom": { "id": "…", "name": "3ème A" },
    "subject": { "id": "…", "name": "Mathématiques" },
    "expectedTeacher": { "id": "…", "displayName": "M. OBAME" },
    "startsAt": "08:00",
    "endsAt": "09:00",
    "exception": null
  },
  "candidates": []
}
```

Si ambigu : `slot=null`, `candidates=[…]`.

### `GET /rooms/:id/qr.pdf` (admin)
PDF d’impression du QR.

### `POST /rooms/:id/qr/rotate` (admin)
Rotation secret ; `publicId` peut rester stable.

---

## 3. Établissement (admin)

### Écoles (national)
- `GET/POST /schools`
- `GET/PATCH /schools/:id`

### Années scolaires
- `GET/POST /school-years`
- `POST /school-years/:id/activate`

### Utilisateurs
- `GET/POST /users`
- `PATCH /users/:id`
- `POST /users/:id/reset-pin` → retourne PIN temporaire une seule fois
- `POST /users/:id/deactivate`

### Classes / matières / salles
- `CRUD /classrooms`
- `CRUD /subjects`
- `CRUD /rooms`

---

## 4. Emploi du temps

### `GET /timetable?schoolYearId&classroomId?&teacherId?&roomId?`
### `POST /timetable/slots`
### `PATCH /timetable/slots/:id`
### `DELETE /timetable/slots/:id` (soft)

### `POST /timetable/exceptions`
```json
{
  "slotId": "…",
  "kind": "replacement",
  "onDate": "2026-07-28",
  "substituteTeacherId": "…",
  "reason": "Absence maladie"
}
```

### `GET /timetable/exceptions?from&to`

---

## 5. Séances (cahier)

### `POST /sessions`
Création brouillon (après PIN ou admin).

```json
{
  "slotId": "…",
  "roomId": "…",
  "clientMutationId": "uuid"
}
```

### `GET /sessions/:id`
### `PUT /sessions/:id`
Corps : `title`, `content`, `competencies`, `exercises`, `homeworkText`, `homeworkDueOn`, `observations`

### `POST /sessions/:id/validate`
```json
{ "pinConfirm": "482913" }
```
Génère `signature_hash`, `validated_at`, version snapshot.

### `GET /sessions`
Filtres : `teacherId`, `classroomId`, `subjectId`, `from`, `to`, `status`, `q`

### `GET /sessions/:id/versions`
### `POST /sessions/:id/attachments` (multipart)
### `DELETE /sessions/:id/attachments/:attachmentId` (soft)
### `DELETE /sessions/:id` — soft delete admin + `{ reason }`

---

## 6. Devoirs

### `GET /homework?status=pending|all&classroomId&from&to`
### `GET /homework/:id`

*(Créés automatiquement depuis la séance si `homeworkText` non vide, ou CRUD dédié phase 2.)*

---

## 7. Tableau de bord

### `GET /dashboard/school?date=`
```json
{
  "sessionsDoneToday": 42,
  "sessionsMissingToday": 7,
  "fillRatePercent": 85.7,
  "byTeacher": [{ "teacherId": "…", "name": "…", "done": 5, "missing": 1 }],
  "byClassroom": [{ "classroomId": "…", "name": "…", "done": 4, "missing": 0 }],
  "recentSessions": [/* … */]
}
```

### `GET /dashboard/national` (agrégats)

---

## 8. Recherche

### `GET /search?q=&types=session,homework,classroom,subject,teacher&limit=20`
```json
{
  "items": [
    { "type": "session", "id": "…", "title": "Théorème de Pythagore", "subtitle": "3ème A · 12/07" }
  ]
}
```

Backend : Postgres full-text + trigram (`pg_trgm`) sur noms.

---

## 9. Notifications

### `GET /notifications?unreadOnly=`
### `POST /notifications/:id/read`
### `POST /notifications/read-all`

---

## 10. Exports

### `POST /exports`
```json
{ "format": "pdf", "classroomId": "…", "from": "2026-01-01", "to": "2026-07-28" }
```
→ `{ jobId }`

### `GET /exports/:jobId`
→ `{ status, downloadUrl? }`

Formats : PDF cahier classe, Excel séances, Excel devoirs.

---

## 11. Audit

### `GET /audit?from&to&actorId&action` (admin)

---

## 12. Sync offline

### `POST /sync/push`
```json
{
  "mutations": [
    { "clientMutationId": "…", "method": "PUT", "path": "/sessions/…", "body": {}, "occurredAt": "…" }
  ]
}
```
→ résultats par mutation (appliqué / conflit / erreur)

### `GET /sync/pull?since=`
Changements serveur pour invalidation cache locale.

---

## 13. Codes HTTP

| Code | Usage |
|---|---|
| 200/201 | OK |
| 202 | Export accepté |
| 400 | Validation |
| 401 | Auth |
| 403 | RBAC |
| 404 | Introuvable |
| 409 | Conflit / idempotence |
| 422 | Règle métier |
| 429 | Rate limit PIN |
| 503 | Maintenance |
