---
"invana": minor
---

Modeller › Graph settings: one page with three tabs — Basic · Database · Members.

- **Graph settings is a page** in the main area, opened from the foot of the Modeller's rail; the
  side panel and the Info panel are gone. While setup is unfinished, Basic leads with the setup
  timeline.
- **Database is always editable**: a summary of the engine, its version and its state, then URI,
  User and Password (`?tab=database`). The stored user is read back; the password never is, and a
  blank password keeps the stored one for both *Test connection* and *Save*. *Save* still waits on a
  passing test.
- **Members** lays Members and Roles side by side, with *Edit* and *Remove* on every row and
  *Add member* in the page head.
- The connection read gains `auth_username`.
