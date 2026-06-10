---
"invana": minor
"studio": minor
---

Add operator user-management CLI: `invana users create [--superuser]` and
`invana users update-password --user <email|username>`. The former provisions
any user (superuser optional); the latter resets a password without the current
one and revokes the user's refresh tokens. Complements the existing root-only,
idempotent `invana init`.

Studio: redesigned login page (ambient grid + glass card) with Create-user and
Forgot-password help modals documenting the CLI / Docker commands.
