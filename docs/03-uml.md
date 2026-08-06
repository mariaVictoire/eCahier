# Diagrammes UML — eCahier

Les diagrammes sont en **Mermaid** (rendus GitHub, Notion, VS Code). Sources de vérité pour l’équipe.

---

## 1. Diagramme de cas d’utilisation

```mermaid
flowchart LR
  subgraph Acteurs
    T[Enseignant]
    SA[Admin établissement]
    NA[Admin national]
  end

  subgraph Système eCahier
    UC1[Scanner QR salle]
    UC2[Confirmer PIN]
    UC3[Remplir cahier]
    UC4[Consulter historique]
    UC5[Rechercher]
    UC6[Gérer enseignants/PIN]
    UC7[Gérer classes/salles/QR]
    UC8[Gérer EDT + exceptions]
    UC9[Consulter tous les cahiers]
    UC10[Exporter PDF/Excel]
    UC11[Superviser écoles]
    UC12[Tableau de bord]
    UC13[Recevoir notifications]
  end

  T --> UC1 --> UC2 --> UC3
  T --> UC4
  T --> UC5
  T --> UC13
  SA --> UC6
  SA --> UC7
  SA --> UC8
  SA --> UC9
  SA --> UC10
  SA --> UC12
  SA --> UC13
  NA --> UC11
  NA --> UC12
```

---

## 2. Diagramme de classes (domaine)

```mermaid
classDiagram
  class School {
    +UUID id
    +String code
    +String name
    +String timezone
  }
  class User {
    +UUID id
    +Role role
    +String pinHash
    +Boolean isActive
  }
  class Room {
    +UUID id
    +String publicId
    +String code
  }
  class Classroom {
    +UUID id
    +String name
    +String level
  }
  class Subject {
    +UUID id
    +String name
  }
  class TimetableSlot {
    +Weekday weekday
    +Time startsAt
    +Time endsAt
  }
  class TimetableException {
    +ExceptionKind kind
    +Date onDate
  }
  class LessonSession {
    +Date sessionDate
    +String title
    +String content
    +SessionStatus status
    +DateTime validatedAt
  }
  class Homework {
    +Date givenOn
    +Date dueOn
  }
  class Attachment {
    +String fileKey
    +String mimeType
  }

  School "1" --> "*" User
  School "1" --> "*" Room
  School "1" --> "*" Classroom
  School "1" --> "*" Subject
  Room "1" --> "*" TimetableSlot
  Classroom "1" --> "*" TimetableSlot
  Subject "1" --> "*" TimetableSlot
  User "1" --> "*" TimetableSlot : teacher
  TimetableSlot "1" --> "*" TimetableException
  TimetableSlot "0..1" --> "*" LessonSession
  User "1" --> "*" LessonSession
  LessonSession "1" --> "*" Homework
  LessonSession "1" --> "*" Attachment
```

---

## 3. Séquence — Scan QR → validation séance

```mermaid
sequenceDiagram
  actor E as Enseignant
  participant PWA as PWA eCahier
  participant API as API NestJS
  participant DB as PostgreSQL
  participant IDB as IndexedDB

  E->>PWA: Scan QR (roomPublicId)
  PWA->>API: GET /rooms/{publicId}/current-slot
  API->>DB: Resolve room + EDT + exceptions
  DB-->>API: SlotContext
  API-->>PWA: classe, matière, prof attendu, créneau
  E->>PWA: Saisie PIN
  PWA->>API: POST /auth/pin
  API->>DB: Verify Argon2id + autorisation créneau
  alt PIN OK
    API-->>PWA: JWT scoped + sessionDraftId?
    E->>PWA: Remplit formulaire
    PWA->>IDB: Autosave brouillon
    PWA->>API: PUT /sessions/{id} (debounce)
    E->>PWA: Valider + signature
    PWA->>API: POST /sessions/{id}/validate
    API->>DB: status=validated + version + audit
    API-->>PWA: OK
  else PIN KO
    API-->>PWA: 401 + lock progressif
  end
```

---

## 4. Séquence — Remplacement enseignant

```mermaid
sequenceDiagram
  actor A as Admin établissement
  actor S as Suppléant
  participant API as API
  participant DB as DB

  A->>API: POST /timetable/exceptions {kind:replacement}
  API->>DB: Insert exception + notification teacher/substitute
  Note over S: Arrive en salle
  S->>API: GET current-slot
  API->>DB: Slot + exception du jour
  API-->>S: expectedTeacher=titulaire, authorizedTeacher=suppléant
  S->>API: POST /auth/pin
  API->>DB: PIN suppléant + exception.authorization
  API-->>S: JWT OK
```

---

## 5. États d’une séance

```mermaid
stateDiagram-v2
  [*] --> Draft: création / scan
  Draft --> Draft: autosave
  Draft --> Validated: signature + validate
  Validated --> Draft: correction admin (nouvelle version)
  Validated --> Locked: clôture période / export officiel
  Locked --> [*]
  Draft --> SoftDeleted: admin + motif
  Validated --> SoftDeleted: admin + motif
```

---

## 6. Déploiement (composants)

```mermaid
flowchart TB
  U[Utilisateurs] --> CF[Cloudflare CDN/WAF]
  CF --> WEB[Next.js PWA]
  CF --> API[NestJS API]
  API --> PG[(PostgreSQL)]
  API --> REDIS[(Redis)]
  API --> R2[(R2 Object Storage)]
  API --> W[Workers BullMQ]
  W --> R2
  W --> PG
  W --> PUSH[Web Push / Email]
```

---

## 7. Modèle de permissions (RBAC)

| Action | Enseignant | Admin école | Admin national |
|---|---|---|---|
| Scan + PIN + saisie ses séances | Oui | Oui* | Non |
| Lire ses séances / devoirs | Oui | Oui | Non |
| Lire toutes séances école | Non | Oui | Lecture agrégée |
| CRUD enseignants / PIN | Non | Oui | Non |
| CRUD salles / QR / EDT | Non | Oui | Non |
| Exceptions / remplacements | Non | Oui | Non |
| Export PDF/Excel école | Non | Oui | Oui (multi) |
| Gérer établissements | Non | Non | Oui |
| Audit logs | Ses actions | École | National |

\*Un admin peut saisir en mode supervision uniquement si feature flag activé.
