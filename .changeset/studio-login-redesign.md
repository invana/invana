---
"studio": minor
---

Redesign the login page as a split layout: a brand panel (Invana / Graph
Intelligence Platform hero, value-prop tagline, and five capability pillars with
icons) alongside the sign-in card. Adds a theme switcher, a "Remember me for 30
days" control (UI only — pending engine support for a token-TTL flag), and moves
the accent glow behind the form. Field text is pinned to the base size so the
design-kit Input's `md:text-sm` no longer shrinks it. The Create-user /
Forgot-password help modals are preserved.
