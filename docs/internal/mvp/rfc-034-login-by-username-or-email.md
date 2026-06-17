# RFC-034: Login by username or email; email becomes optional

**Status**: Accepted
**Author**: Invana Team
**Date**: 2026-06-17
**Related**:
- **RFC-017** (Graph as the Primary Container) — established `username` as the globally-unique,
  URL-facing identity (`/u/{username}/{slug}/...`). This RFC makes that same `username` a login
  credential, which it was not before.
- **RFC-023** (Drop graph roles + invitations) — superuser-provisioned accounts; the admin supplies
  the account's email directly. With email now optional, provisioning no longer requires one.

---

## Problem / intent

`users.email` is currently `NOT NULL UNIQUE` and is the **sole login credential** — `POST /auth/login`
takes `{email, password}` and `authenticate()` resolves the user by email only. Meanwhile `username`
is already the canonical identity everywhere else (required, globally unique, every graph-scoped URL
is built on it).

We want to make `email` **optional** — accounts (operator-provisioned users, the default dev
superuser when no real mailbox exists, future SSO-less installs) shouldn't be forced to carry one.

But making `email` nullable while login stays email-based produces an **incoherent half-state**:
an account can exist yet be unable to sign in. The fix is to promote the identity that is *already*
mandatory and unique — `username` — to also be a login credential.

## Design

1. **`users.email` is nullable.** Keep the existing `UNIQUE` index — Postgres treats NULLs as
   distinct, so any number of email-less accounts coexist. (Migration `00000000001a`.)

2. **Login accepts username *or* email.** `POST /auth/login` takes an `identifier` field (a username
   or an email). The service resolves it via the existing
   `find_user_by_email_or_username(session, identifier=...)` helper (already present, previously
   unused by `login()`). The constant-time "unknown user" guard is preserved.

   - **Backward compatibility**: `identifier` carries a validation alias of `email`, so existing
     clients posting `{email, password}` keep working. Studio is updated to post `{identifier}`.

3. **Studio login form** is relabeled "Email or username" (input `type=text`,
   `autocomplete=username`) and posts `identifier`.

### Out of scope (explicit non-goals)

- **Password reset / recovery by email.** Still operator-driven (`invana users update-password`).
  An email-less account simply has no self-service recovery — unchanged from today.
- **Public sign-up.** Still none (RFC-023). Users are provisioned by a superuser / CLI.
- **Changing `username` immutability rules** or the URL model (RFC-017 stands).

## Consequences

- Login is no longer email-only. An account **without** an email can sign in by username; an account
  **with** an email can sign in by either. The default dev superuser keeps `hi@invana.local`, so both
  paths work out of the box.
- The `/auth/login` contract gains `identifier` (with `email` accepted as an alias). Non-breaking.
- Audit `auth.login` / `auth.login_failed` events record the submitted `identifier` (failures) and the
  resolved `username` (success) instead of assuming an email is present.

## Touch points

- Engine: `auth/models.py` (nullable email), migration `00000000001a`, `auth/schemas.py`
  (`LoginRequest.identifier`, `UserOut.email` optional), `auth/services.py` (`login()`,
  `bootstrap_root()`, `provision_user()`), CLI `init` / `users create`.
- Studio: `services/api/auth.ts`, `pages/auth/LoginPage.tsx`.
