---
"studio": patch
---

The sign-in page resumes the session you already have. Landing on
`/login?next=…` with a session in the browser no longer asks for a password
again: Studio proves the stored session against `/auth/me` — rotating an
expired access token on the way — and redirects to `next`. A stored session
that no longer verifies is cleared and the form appears as before. `next` is
followed only when it is an in-app path.
