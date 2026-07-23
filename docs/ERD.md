# ERD — WRBH Club Management

```mermaid
erDiagram
  Club ||--o{ Season : has
  Club ||--o{ Discipline : has
  Club ||--o{ Venue : has
  Club ||--o{ Document : has
  Season ||--o{ Category : defines
  Season ||--o{ Registration : opens
  Season ||--o{ FeePlan : prices
  Discipline ||--o{ Category : groups
  Category ||--o{ Team : splits
  Team ||--o{ TeamCoach : staffed
  User ||--o{ TeamCoach : coaches
  Athlete ||--o{ TeamMembership : plays_in
  Team ||--o{ TeamMembership : has
  User ||--o{ ParentChild : parent
  Athlete ||--o{ ParentChild : child
  Athlete ||--o{ Registration : enrolls
  Registration ||--o{ Attachment : docs
  Athlete ||--o{ EmergencyContact : has
  Athlete ||--o{ FeeInstallment : owes
  FeeInstallment ||--o{ Payment : paid_by
  Payment ||--o{ Receipt : generates
  User ||--o{ Payment : recorded_by
  Club ||--o{ LedgerEntry : finance
  User ||--o{ CoachPayroll : paid
  Team ||--o{ Event : schedules
  Venue ||--o{ Event : hosts
  Event ||--o{ EventException : overrides
  Event ||--o{ Convocation : invites
  Athlete ||--o{ Convocation : invited
  Convocation ||--o{ Attendance : marked
  Club ||--o{ Announcement : posts
  User ||--o{ MessageThread : participates
  User ||--o{ PushToken : devices
  InventoryItem ||--o{ InventoryAssignment : loaned
  Athlete ||--o{ InventoryAssignment : receives
  User ||--o{ AuditLog : actions

  User {
    int id PK
    string email
    string phone
    string full_name
    string full_name_ar
    string role
    string password_hash
    bool is_active
  }
  Athlete {
    int id PK
    string legacy_number
    string full_name
    date birth_date
    string birth_place
    string status
  }
  Category {
    int id PK
    string code
    int birth_year_min
    int birth_year_max
  }
  Event {
    int id PK
    string type
    datetime starts_at
    string recurrence_rule
    string opponent
    string home_away
  }
  FeeInstallment {
    int id PK
    string label
    date due_date
    decimal amount
    string status
  }
```

## Rôles & permissions (résumé)

| Module | admin | direction | staff | coach | parent |
|--------|-------|-----------|-------|-------|--------|
| Structure club | CRUD | R/W | R | R | — |
| Athlètes / inscriptions | CRUD | CRUD | CRUD | R (équipe) | R (enfants) + inscription |
| Agenda | CRUD | CRUD | CRUD | R/W équipe | R + confirmer convocation |
| Présences | CRUD | R | R | W équipe | R enfants |
| Finance cotisations | CRUD | CRUD | W | — | R enfants |
| Dépenses / paie | CRUD | CRUD | W limité | — | — |
| Inventaire | CRUD | CRUD | W | R | — |
| Annonces / messages | CRUD | CRUD | W | W | W fils |
| Audit | R | R | — | — | — |
