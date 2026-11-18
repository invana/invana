---
id: AC-F10
title: Keys
product: AC
status: idea
personas: [admin, builder, analyst]
stories: [AC-10]
journeys: [J07]
boards: [settings.me, access.signin, settings.people, projects.projects]
nfrs: [NFR-SEC-1, NFR-SEC-2, NFR-SEC-4]
depends_on: [AC-F01, AC-F02, AC-F03, AC-F06, PJ-F01]
---

# Keys

> A long-lived credential for software — a script, CI, an integration, Claude Code — that belongs to a person or to a
> project, acts with its owner's policies and never more, narrowed to what one job needs, expiring, and shown once.
> The decision it helps make: *what may this piece of software do in my name — or in my project's — and for how long?*

## User journey

Journeys this feature is a step of: [J07 · Ready a deployment](../../../../journeys/J07-ready-a-deployment.md)

```mermaid
flowchart TD
  me([Settings › You › Keys]) --> list["AC-10 · Own personal keys"]
  pj([A project › Keys]) --> pk{"Manage on Projects for it?"}
  pk -->|no · on its team| pr(["Its keys read · New key disabled, naming the permission"])
  pk -->|yes| plist["AC-10 · The project's keys"]
  ad([Access › Who › Keys]) --> who{"Manage on Access?"}
  who -->|no| lk(["Locked · names the permission and who can grant it"])
  who -->|yes| all["AC-10 · Every key in the deployment"]
  list --> mint["AC-10 · New key: name · expiry · narrow to"]
  plist --> mint
  mint -->|name taken · at the ceiling| ref["Refused in place, naming why"]
  mint --> again["Sign in again: password"]
  again -->|right| secret(["The secret, once"])
  again -->|wrong| no(["Refused · counts toward the lock"])
  list --> rv["AC-10 · Revoke · password"]
  all --> rv
  plist --> rv
  rv --> gone(["Revoked · the next call is refused"])
  use([A script calls]) --> chk{"Live · a personal key's person active?"}
  chk -->|no| r1(["Refused · revoked, expired or deactivated"])
  chk -->|yes| reach{"The owner's policies ∩ the agent's ceiling ∩ the key's rules allow it?"}
  reach -->|no| r2(["Refused · names the rule"])
  reach -->|ask| ask(["An ask to the agent's named approvers (AC-F05)"])
  reach -->|yes| ok(["Done for the owner, through the agent · History names the key"])
```

## Stories

| ID | Story | Status |
|---|---|---|
| AC-10 | [Mint a key that acts as its owner, narrowed](stories/AC-10-mint-a-key-that-acts-as-its-owner-narrowed/story.md) | idea |

## Access

Each act needs the permission named, from [the permission catalogue](../AC-F02-access-policies/feature.md#the-permission-catalogue).

| Act | Permission | Everyone else sees |
|---|---|---|
| Read one's own personal keys · mint · revoke one | None — every signed-in person, in a session; minting and revoking sign in again | — |
| Read a project's keys | Anyone on the project's team, or Manage on Projects for it (`project/<project>`) | Absent (`404`) |
| Mint · revoke a project key | Manage on Projects for that project (`project/<project>`), in a session, signing in again | *New key* disabled — *Needs Manage on Projects — ask Priya or Lee* |
| Read every key in the deployment · revoke any | Manage on Access, in a session; revoking signs in again | *Access › Who › Keys* locked, naming the permission and who can grant it; another person's key is absent (`404`) |
| Any key act with a key | No one — keys are managed from a session | Refused — *This needs a person's session, not a key* |

## States

| State | What the person sees |
|---|---|
| First use | *No keys yet* — *For scripts and Claude Code. A key acts as you, can do less than you, and expires* — with *New key* |
| Empty after a filter | *Nothing matches*, with the filter named and *Clear filters* |
| Loading | The tab opens at once; the list shows loading rows |
| Has data | One row per key: name · owner — a person or a project · last four · narrowed to · expires · last used; expired and revoked keys marked |
| Failed | What could not load or save, in a sentence, with *Try again*; a refused mint says why in place |
| Agent working or proposing | — no agent mints or revokes a key |
| No access | Without Manage on Access, *Access › Who › Keys* reads locked, naming the permission; one's own keys are on *Settings › You › Keys*, a project's on its *Keys* |

## Rules

| Rule | Detail |
|---|---|
| A key belongs to a person or a project | **Personal key** — minted by a person for themselves; acts with that person's policies ∩ the agent's ceiling, as a run outside a project does ([AC-F02 › Rules](../AC-F02-access-policies/feature.md#rules)) · **Project key** — minted for a project; every run it starts is inside the project and acts with the project's policies ∩ the agent's ceiling. Either way the key's own rules narrow it further, all read at each call. A key never does more than its owner |
| A project key outlives the people | It keeps working when people join or leave the team, its minter included; archiving or deleting the project revokes it. Use it for CI, integrations and MCP clients that are not one person |
| A key holds no policy | It inherits from its owner — a person or a project — and only narrows ([AC-F02 › Rules](../AC-F02-access-policies/feature.md#rules)) |
| History names the key | Every call and every run a key starts is in History with the key named, and its owner — for a project key, the project, where a person would be ([AC-F06](../AC-F06-history/feature.md)) |
| A key meets *Hidden from agents* | A key reads under its owner and the agent it calls, whose ceiling carries *Hidden from agents*; a raw query through a key is refused where the owner's or the agent's policies hide anything in that graph database ([AC-F02 › Property access](../AC-F02-access-policies/feature.md#property-access)) |
| A key only narrows | Its own rules are Allow · verb · resource in the grammar of [Access Policies](../AC-F02-access-policies/feature.md#rules); what they do not name, the key cannot do. *Read only* is where a new key starts |
| A key expires, or says it never does | 30, 90 or 365 days, or never; 90 is offered first. An expired key stays listed until revoked |
| Shown once | The secret is in the mint's answer only; the engine keeps its hash and last four |
| Managing credentials and access needs a session | A key never mints or revokes a key, changes a password, changes access or connects a client; a person minting or revoking signs in again |
| Who reads a key | A personal key: its person and holders of Manage on Access · a project key: its team, Manage on Projects for it and Manage on Access. Anyone else finds it absent |
| A ceiling per owner | 20 live keys per person and per project unless the deployment sets another |
| In the header only | A key travels in `Authorization: Bearer`; a key in a URL is not accepted |
| Keys outlive a password change | A script should not break because its owner changed their password; deactivating a person stops their personal keys, never a project's |
| Leans on | Sessions and signing in again (AC-F01) · the Directory — deactivation (AC-F03) · Access Policies and the one evaluator (AC-F02) · asks (AC-F05) · History (AC-F06) · projects, their teams and policies (PJ-F01) |

## Data touched

| Record | Read or write |
|---|---|
| Keys — owner, name, hash, last four, own rules, expiry, last use, revocation | Write · read |
| A personal key's person — active state and policies (AC-F03 · AC-F02) · a project key's project — its team, its policies and whether it is archived (PJ-F01) | Read |
| History rows of a mint, a revoke and a refused call (AC-F06) | Write |

## Engine

The low-level design: what this feature stores, serves and refuses. Conventions — naming, errors, lists, events — are
[system-design.md](../../../../system-design.md) §§ 6–8; this section only fills them in.

### Records

| Table | Columns | Notes |
|---|---|---|
| `access_keys` | `owner_kind` (`user` · `project`) · `owner_id` (a person or a project) · `name` (1–64) · `token_hash` (sha256, unique) · `last_four` · `narrowed` (`read_only` · `everything` · `rules`) · `created_by_id` · `created_at` · `expires_at?` · `last_used_at?` · `revoked_at?` · `revoked_by_id?` | Unique (`owner_kind`, `owner_id`, `name`) among live keys. A key holds no policy attachment |
| `access_key_rules` | `key_id` · `verb` (`read` · `write` · `run`) · `resource` (`type/name`, whole-segment `*`) | Present only when `narrowed = rules`; deleted with the key's revocation |

### Reads

| Record | Owner |
|---|---|
| A session, signing in again and the lock | [AC-F01](../AC-F01-sign-in-account-and-sessions/feature.md#engine) |
| A person's active state | [AC-F03](../AC-F03-directory/feature.md#engine) |
| A project, its team, its policies and whether it is archived | [PJ-F01](../../../../capabilities/projects/features/PJ-F01-projects-and-tasks/feature.md#engine) |
| The resource grammar and the one evaluator | [AC-F02](../AC-F02-access-policies/feature.md#engine) |
| History — every event this feature writes | [AC-F06](../AC-F06-history/feature.md#engine) |

### Routes

| Route, after `/api/v1/access` | Does | Story |
|---|---|---|
| `GET /keys` | By the list contract (`?owner=` · `?project=` · `?state=` `live` · `expired` · `revoked` · `?q=` on name): Manage on Access reads every key; anyone else their own personal keys and the keys of projects they are on or hold Manage on Projects for — `name` · `owner_kind` · `owner` · `last_four` · `narrowed` · `rules[]` · `expires_at?` · `last_used_at?` · `created_by` · `state` | AC-10 |
| `GET /keys/{id}` | One key; `404` to anyone [Who reads a key](#rules) does not name | AC-10 |
| `POST /keys` | Mint `{name, project?, expires_in_days: 30 \| 90 \| 365 \| null, narrowed, rules?[], password}` — `project` makes a project key, else a personal key; the secret only in this answer | AC-10 |
| `DELETE /keys/{id}` | Revoke `{password}` — its person; for a project key, Manage on Projects for it; or Manage on Access | AC-10 |

### Events

| Event | When |
|---|---|
| `access.keys.create` · `access.keys.revoke` | A key is minted · revoked — the key's name, its owner — a person or a project — and who acted; never the secret |
| `access.keys.use` | A key calls — the key named as the actor, with its owner; once per key per minute, and on every run it starts |
| `access.keys.refused` | A key's call is refused — revoked, expired, owner deactivated, or outside its rules; once per key per minute |

### Refusals

| Status | When | Sentence | Criterion |
|---|---|---|---|
| 401 | A revoked key | *This key was revoked on {date}.* | AC-10.9 |
| 401 | An expired key | *This key expired on {date}.* | AC-10.10 |
| 401 | A personal key whose person is deactivated | *This account is deactivated.* | AC-10.8 |
| 401 | A key in a URL, or a value no key has | *Send a key in the Authorization header.* | AC-10.14 |
| 403 | A call outside the key's own rules | *Key {name} does not allow {verb} on {resource}.* | AC-10.5 |
| 403 | A call the owner's policies or the agent's ceiling do not allow | [AC-F02 › Refusals](../AC-F02-access-policies/feature.md#refusals) | AC-10.6 |
| 403 | Any key route, or another session-only act, called with a key | *This needs a person's session, not a key.* | AC-10.12 |
| 401 | Mint or revoke without the password, or with a wrong one | *Enter your password again to do this.* | AC-10.2 · AC-10.9 |
| 403 | Minting or revoking a project key without Manage on Projects for it | [AC-F02 › Refusals](../AC-F02-access-policies/feature.md#refusals) | AC-10.7 |
| 404 | Reading or revoking a key [Who reads a key](#rules) does not allow | *Not found.* | AC-10.16 |
| 409 | A name the owner uses on a live key | *{name} is taken.* | AC-10.20 |
| 409 | An owner at the ceiling | *{owner} has {n} live keys — revoke one first.* | AC-10.11 |
| 422 | An expiry other than 30, 90, 365 days or never | *A key expires in 30, 90 or 365 days, or never.* | AC-10.2 |

### CLI

| Command | Does |
|---|---|
| `invana keys list [--owner] [--project]` | Keys as `GET /keys` reads them |
| `invana keys revoke <id>` | Revokes, as `DELETE /keys/{id}`; prompts for the password |

### Mechanisms

| Mechanism | How |
|---|---|
| The secret | `invana_pat_` + 32 random bytes, base64url; only its sha256 and last four are stored |
| Telling a key apart | A `Bearer` value with the `invana_pat_` prefix is looked up by hash ([AC-F01 › Mechanisms](../AC-F01-sign-in-account-and-sessions/feature.md#mechanisms)) |
| Key ∩ owner | A personal key's call is checked as its person — their policies and teams, then the agent's ceiling; a project key starts its runs inside the project — the project's policies, then the agent's ceiling ([AC-F02 › The order of checks](../AC-F02-access-policies/feature.md#the-order-of-checks)) — and then against the key: `everything` passes, `read_only` passes Read only, `rules` passes only a verb and resource one of its rules matches. Both must pass; the stricter refusal is the one named |
| Read at each call | Revocation, expiry, a person's deactivation and every change to the owner's policies take effect on the next call; nothing is cached on the key |
| Last used | `last_used_at` is written at most once a minute per key |
| Revoking | Sets `revoked_at` and `revoked_by_id` and deletes the key's `access_key_rules`; in the same act stops every run with its `key_id` that is queued or running, as [a stop](../../../control/features/CP-F10-runs-and-how-the-agents-are-doing/feature.md#mechanisms) does, `stopped_by_id` the revoker — a History row for the revoke and one per run. When the revoker is not the owner, an Update reaches the owner — for a project key, its minter — in the Inbox ([CP-F08](../../../control/features/CP-F08-the-inbox/feature.md)), naming the key and who revoked it |
| A project ends | Archiving or deleting a project revokes its keys in the same act, `revoked_by_id` the person who did it ([PJ-F01](../../../../capabilities/projects/features/PJ-F01-projects-and-tasks/feature.md#engine)) |
| Session-only | Every route here refuses a key and a connected client's token; mint and revoke verify `password` as [signing in again](../AC-F01-sign-in-account-and-sessions/feature.md#mechanisms) does |
| Never in a log | The secret enters no event, log line, span or ledger row (NFR-SEC-2) |

## System impact

| HLD section | Change | NFRs |
|---|---|---|
| § 6 Data and storage | Two tables in Postgres | — |
| § 8 APIs and events | The `/api/v1/access/keys` routes and `access.keys.*` events; who calls and how they prove it — a script or the CLI | — |
| § 12 Qualities | Security: a key acts as key ∩ its owner — a person or a project — ∩ the agent's ceiling, read at every call; secrets shown once and stored hashed; managing keys needs a session and the password again | NFR-SEC-1 · NFR-SEC-2 · NFR-SEC-4 |

The code change is [migrations.md](../../../../migrations.md) M14.

## Decisions

| Decision | Detail |
|---|---|
| Keys are their own feature | A credential for software is not a Directory entry; personal keys live on *Settings › You › Keys*, a project's on its *Keys*, and every key, for Admins, on *Access › Who › Keys* |
| A key belongs to a person or a project | Automation that is no one person's is a project key: its reach is the project's policies, already reviewed, and it outlives anyone on the team |
| A key starts at Read only | The minter widens it on purpose — to *Everything I may do* or named rules — and sees what it will do before it is made |
| A key's rules only Allow | A key narrows; Ask and Deny are its owner's agents' policies' to say. What a key's rules do not name, it cannot do |
| No key marked for agents | Every act already runs through an agent and its Access Policies; a key needs no mark of its own to be held to them |
| Revoking asks for the password too | Every change to keys signs in again, the same as access and credentials |
| Revoking stops its runs | A revoked key's queued and running runs stop with it, so ending a key ends what it set going |
| The owner is told | A key revoked by someone else is an Update in its owner's Inbox, naming the key and who revoked it |

## Open questions

| Question | Who answers |
|---|---|

## Not building

| Item | Why not |
|---|---|
| A key that acts as more than its owner | A key is software borrowing a person's or a project's reach, never widening it |
| A user for automation | A project key does that job; a user of its own would hold policies outside any project's review |
| Keys that manage keys or access | Automation never changes who may do what |
| Showing a secret again | Only its hash is kept |
| A key bound to one graph database or agent by itself | The key's rules name resources — `data/<graph-database>/…` or `agent/<name>` — when a job needs only one |
| Rotating a key in place | Mint a new one, move the script, revoke the old one |
| Keys in a URL | Addresses end up in logs and histories |
