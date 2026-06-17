---
"invana": minor
"studio": minor
---

Optional email + login by username or email (RFC-034), plus a one-step `make engine-init` bootstrap.

The `email` column on `users` is now nullable — accounts can be provisioned without an email via `invana users create` (and the service layer). Login (`POST /auth/login`) now accepts an `identifier` that is either a **username or an email** (`email` is still accepted as a back-compat alias), so email-less accounts sign in by username. Studio's login form is relabeled "Email or username".

`invana init` now defaults to a standard development superuser (username `admin`, email `hi@invana.local`, password `change_me_please`) so a bare `invana init --non-interactive` — or the new `make engine-init` target, which migrates then bootstraps — provisions it. Change the default password after first sign-in.
