---
id: AC-F01
title: Sign in, account and sessions
product: AC
status: idea
personas: [analyst, owner, builder, admin]
stories: [AC-01, AC-02]
journeys: [J01, J02, J05]
boards: [start.signin, settings.me]
depends_on: [AC-F02]
---

# Sign in, account and sessions

> Sign in with an account an Admin made, and keep it in order: a person's own account — their name, password and username — the address every Graph link starts with — and the
> places they are signed in. The decision it helps make: *is my account mine, and is every place it is signed in one I
> trust?*

## User journey

Journeys this feature is a step of: [J01 · From an empty install to a first answer](../../../../journeys/J01-from-an-empty-install-to-a-first-answer.md) · [J02 · Ask and trust the answer](../../../../journeys/J02-ask-and-trust-the-answer.md) · [J05 · Join a Graph someone set up](../../../../journeys/J05-join-a-graph-someone-set-up.md)

```mermaid
flowchart TD
  a([Invana's address]) --> si["AC-01 · Sign in: email and password, or single sign-on"]
  si -->|wrong email or password| sf["Says it could not sign in, never which part was wrong"]
  sf --> si
  si -->|no account| na["Ask your admin for an account"]
  si -->|signed in| home(["GR-F01 · Home"])
  si -->|session ends| back["Back to sign in · then the page they were on"]
  s([Settings › You › Profile and keys]) --> p["AC-02 · Name · email · time zone"]
  p --> pw["AC-02 · Change password"]
  pw -->|too short| pf["Says the minimum length"]
  pw -->|changed| out(["Every other session ends · keys keep working"])
  p --> un["AC-02 · Change username"]
  un -->|inside the cooldown| cd["Refused · names the date it unlocks"]
  un -->|invalid or taken| ut["Names the rule it broke, or that it is taken"]
  un -->|ok| warn{"Old links stop working — confirm?"}
  warn -->|yes| ch(["Changed · new links work at once · old ones are not found"])
  warn -->|no| p
  p --> se["AC-02 · Where you are signed in"]
  se -->|Sign out here| so(["This device signs in again"])
  se -->|Sign out everywhere| sa(["Every device signs in again on its next call"])
  p --> keys(["AC-10 · Your keys"])
  p --> del["AC-02 · Delete my account"]
  del -->|confirm| gone(["Deleted outright"])
  w([Working in Studio]) --> exp{"Session"}
  exp -->|access expired| re(["Renewed underneath · the act completes"])
  exp -->|signed out elsewhere · expired| sign(["Sign in again · back where they were"])
  exp -->|removed from the Graph| rm(["The next call is refused · says access changed"])
```

```mermaid
sequenceDiagram
  actor P as Person
  participant S as Studio
  participant E as Engine
  P->>S: works
  S->>E: a call with a short-lived session token
  E->>E: who you are from the token · membership looked up now
  E-->>S: allowed, or refused
  Note over S,E: the short-lived token expires
  S->>E: renew with the long-lived one
  E->>E: retire it · issue a new pair
  E-->>S: new pair · the call is retried
  S->>E: renew with a retired one
  E-->>S: refused · recorded in History
```

## Stories

| ID | Story | Status |
|---|---|---|
| AC-01 | [Sign in](stories/AC-01-sign-in/story.md) | idea |
| AC-02 | [Keep my account, username and sessions in order](stories/AC-02-keep-my-account-username-and-sessions-in-order/story.md) | idea |

## Access

| Act | Role (`.claude/team/TEAM.md` §7) | Everyone else sees |
|---|---|---|
| Sign in | Anyone with an account | *Ask your admin for an account* — there is no sign-up form |
| Read and change one's own name, password and username | The person themselves — any signed-in account | — |
| Sign out here · sign out everywhere | The person themselves | — |
| Delete one's own account | The person themselves, signed in — never with a key | — |
| Another person's account | No one in Studio; install administration only | — |

## States

| State | What the person sees |
|---|---|
| First use | The account as made at sign-up: name, email, username; one session — this one |
| Empty after a filter | — no filter on this surface |
| Loading | Sign in shows its card at once and the button says it is signing in; the account section opens at once, fields filling in place |
| Has data | Profile, username and its rules, the places they are signed in, their keys |
| Failed | Sign in says it could not sign in, never which part was wrong; on the account, what could not save, in a sentence, naming the rule — the minimum length, the cooldown's end, a taken username |
| Agent working or proposing | — no agent acts on an account |
| No access | A person without an account reads *Ask your admin for an account*; every person reaches their own account, nobody reaches another's |

## Rules

| Rule | Detail |
|---|---|
| Email is how a person signs in | Unique, folded to lowercase; changing it is its own act |
| Errors never confirm an account | A failed sign-in or sign-up never says whether an email is in use |
| A username is an address | `/u/<username>/<graph>/…`; lowercase letters, digits and single hyphens, 2–64 characters, unique on the install. Only `u` is reserved |
| A username changes rarely | Once per cooldown — thirty days unless the install sets another |
| Old addresses do not forward | After a change, old links are not found; the change says so before it is confirmed |
| A session is short-lived and renewable | A short-lived token for every call, a long-lived one that renews it; renewing retires the old one |
| Reusing a retired session is a signal | It is refused and recorded |
| Membership is checked on every call | So removing someone from a Graph takes effect at once |
| A password change ends every other session | Keys keep working — a script should not break because a person changed their password |
| Managing credentials needs a session | Changing a password and deleting the account cannot be done with a key |
| Already signed in | Reaching the sign-in page with a live session resumes it and goes where the person was heading; only an address inside Studio is followed |
| Deletes are outright | There is no trash for an account |
| A session ends cleanly | When it ends, the person signs in again and returns to the page they were on |
| Leans on | Keys (AC-10) · Home (GR-F01) · History (AC-F06) |

## Data touched

| Record | Read or write |
|---|---|
| The account — email, username, name, password, when the username last changed | Write · read |
| Sessions — the long-lived renewing token, retired or live | Write · read |
| Keys (AC-10) | Read |
| History rows of a password change, a username change and a refused reuse (AC-F06) | Write |

## Decisions

| Decision | Detail |
|---|---|
| You is a part of Settings | *Settings › You › Profile and keys* holds the profile, username, sessions and keys; there is no profile page of its own |
| One name, one address | The username is both what a person is called in links and their address; there is no separate display handle |
| Password rules are configuration | Minimum length and hashing cost are the install's, with sane defaults |
| No sign-up form | Accounts are made by an Admin; the sign-in card says whom to ask |
| Being Admin opens no Graph | The install Admin runs the install; it is never a way into a Graph's contents |

## Open questions

| Question | Who answers |
|---|---|
| Does *Where you are signed in* list each device, or only offer *Sign out here* and *Sign out everywhere*? The board draws neither yet. Recommend: the two acts only — a list needs device names the engine does not keep | Ravi |

## Not building

| Item | Why not |
|---|---|
| A sign-up form | Accounts are made by an Admin |
| Email verification | Not what stands between a person and value yet |
| Password reset by email | Needs a mail path the product does not have |
| Avatars and bios | An account is an identity, not a profile page |
| Single sign-on | Later, once someone needs it |
| Redirects from old usernames | An address that forwards silently hides a rename |
| A list of reserved words | The `/u/` prefix makes them unneeded |
| Device fingerprinting | Signing out here or everywhere is enough to act on |
| Long sessions for convenience | A session stays short; a person who needs a long-lived credential mints a key (AC-10) |
