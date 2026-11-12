---
id: AC-01
title: Sign in
feature: AC-F01
status: idea
personas: [analyst, owner, admin]
boards: [access.signin]
---

# AC-01 · Sign in

**As** an analyst **I want** to sign in with my email and password or the install's single sign-on **so that** only
people with an account reach a Graph, and I come back to the page I was on.

Tasks: [task.md](task.md) · Feature: [AC-F01](../../feature.md)

## Who can

| Lens | Can | Otherwise sees |
|---|---|---|
| Admin | Sign in with a password or single sign-on; lands on Home | — |
| Operator | Sign in with a password or single sign-on; lands on Home | A person without an account reads *Ask your admin for an account* |

## Flow

```mermaid
flowchart TD
  a([Invana's address, or a link to a page]) --> c["Sign in: email · password · Sign in — or Single sign-on"]
  c --> t{"Signed in?"}
  t -->|yes, from a link| p(["The page the link named"])
  t -->|yes| h(["Home"])
  t -->|wrong email or password| f["Could not sign in · neither part named"] --> c
  t -->|single sign-on refused| sf["Says the sign-on was refused, in its own words"] --> c
  t -->|no account| na["Ask your admin for an account"]
  h -->|session ends| c
```

## Acceptance criteria

| # | Given | When | Then |
|---|---|---|---|
| AC-01.1 | Sign in opens | it draws | one card: Invana, the install's address, email, password, *Sign in*, and *Single sign-on* when the install has one — nothing else |
| AC-01.2 | A right email and password | the person signs in | they land on Home |
| AC-01.3 | A wrong email or password | the person signs in | it says it could not sign in, never which of the two was wrong, and keeps the email |
| AC-01.4 | An install with single sign-on | the person picks it and the provider accepts | they land on Home; a refusal is shown in the provider's words |
| AC-01.5 | A link to a page and no session | the person signs in | they land on that page, not Home |
| AC-01.6 | A session that ends | the person acts | they are sent to sign in and, once signed in, returned to the page they were on |
| AC-01.7 | Signing in | it is waiting on the engine | the button says it is signing in and cannot be pressed twice |
| AC-01.8 | A person without an account | they read the card | it says *Ask your admin for an account*; there is no sign-up form |

## Screens

| Surface | Lens | First use | Empty after a filter | Loading | Has data | Failed | Agent working or proposing | No access |
|---|---|---|---|---|---|---|---|---|
| Sign in | Admin | access.signin | — | access.signin · Signing in | access.signin | access.signin · Could not sign in | — | — |
| Sign in | Operator | access.signin | — | access.signin · Signing in | access.signin | access.signin · Could not sign in | — | access.signin · No account |
