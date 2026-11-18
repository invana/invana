---
id: AC-27
title: Keep a kind or a property from agents
feature: AC-F02
status: idea
personas: [modeller, admin, analyst]
boards: [settings.policies]
---

# AC-27 · Keep a kind or a property from agents

**As** an admin **I want** one list of the kinds and properties the deployment hides from every agent, each with the
reason it is hidden, that I alone add to and remove from **so that** an agent never sees what it must not, and no
answer hints that it exists.

Tasks: [task.md](task.md) · Feature: [AC-F02](../../feature.md)

## Who can

*Hidden from agents* is read with Read on `access/policies`; its entries change with Manage on Access, which needs that Read, signing in
again. Removing an entry waits for a second Admin whatever the second-yes setting
([AC-F02 › Property access](../../feature.md#property-access)).

| Access | Can | Otherwise sees |
|---|---|---|
| Admin | Read *Hidden from agents*; add an entry — a kind or a property of a graph database, with a reason; ask to remove one, which another Admin approves; read *Who it changes* first | Their own removal waits — no *Approve* on it |
| Operator | Nothing here: without Read on `access/policies` they never see what is hidden | *No access* — *Needs Read on access/policies — ask Priya or Lee* |

## Flow

```mermaid
flowchart TD
  s([Access Policies › Hidden from agents]) --> g{"Read on access/policies?"}
  g -->|no| na["No access · names the permission and who can grant it"]
  g -->|yes| k{"Anything hidden?"}
  k -->|no| e["Nothing is hidden from agents · Add an entry"]
  k -->|yes| l["Entries: each kind or property, its graph database, its reason, who added it and when"]
  l -->|Add an entry| a["A kind or property · a reason · Who it changes · sign in again"]
  l -->|Remove| rm["Who it changes · sign in again · waits for a second Admin"]
  a -->|no reason · a name that does not exist| ref["Refused in place, naming the field"]
  a --> hist(["Saved · History records who, what and why · in force at the next check"])
  rm -->|another Admin approves · the others are told| hist
  rm -->|declined| keep(["The entry stays"])
  q([A run's typed query plan or a write]) --> c{"It names a kind or property an entry hides?"}
  c -->|yes| unk(["Fails as an unknown kind or property · the same as one that does not exist"])
  c -->|no| go(["It runs"])
  rq([A raw query]) --> rh{"The caller's policies hide anything in that graph database?"}
  rh -->|yes| rr(["Refused · one sentence · no kind and no rule named"])
  rh -->|no| go
```

## Acceptance criteria

| # | Given | When | Then |
|---|---|---|---|
| AC-27.1 | A reader with Read on `access/policies` | *Hidden from agents* is read | it lists every entry — the kind or property, its graph database, its reason, who added it and when; with none, *Nothing is hidden from agents* |
| AC-27.2 | An entry on `data/<graph database>/Customer` | a typed query plan of any agent names Customer in that graph database | the plan fails as *There is no kind Customer*, the sentence of a kind that does not exist; nothing names the entry and no record is read |
| AC-27.3 | An entry on `data/*/Customer` | a plan names Customer in any graph database | it fails the same way; the entry reaches every graph database's Customer, every property of it |
| AC-27.4 | A question that needs a kind or property an entry hides | the run settles | the answer is made from what the agent can see and never says anything was hidden; when nothing is left to answer from, it ends *cannot answer · not in Graph Data* |
| AC-27.7 | A run | the person opens *How it got here* | it names only the steps and sources the agent could see; nothing names a hidden kind or property |
| AC-27.9 | A policy file | it is applied from the command line | a Deny on `data/…` is saved like any rule (AC-04.15); a file never adds to or removes from *Hidden from agents* — its entries change only in Access |
| AC-27.10 | A person without Read on `access/policies` | they open *Hidden from agents* | it reads *No access*, naming Read on `access/policies` and who can grant it; nothing is listed and nothing says what is hidden |
| AC-27.11 | An agent with `Allow Read data/*` and an entry on one property of a kind | it reads that kind | every other property is in the result; the result carries no count and no note of what is left out; the read is not refused |
| AC-27.13 | An entry on a property | an agent's query names it | the query fails as *{kind} has no property {property}*, the sentence of a property that does not exist, and the schema the AI model is told never listed it |
| AC-27.19 | An entry on a kind or a property | an agent-started run writes to it — a load, a record edit or a model publish | the write fails as *There is no kind {kind}* or *{kind} has no property {property}*, as for one that does not exist; nothing is written. When a person starts the same act through the Loader, the Record editor or the Modeller, the person's own policies decide, not the entry |
| AC-27.20 | An Admin | they add an entry and give no reason, or name a kind or property that does not exist | it is refused in place, naming the field |
| AC-27.21 | An Admin with Manage on Access and Read on `access/policies` | they add an entry with a reason and sign in again | *Who it changes* names each person and run it changes first, and says that copies made before it — memory, transcripts, boards, findings, saved plans — stay as they are; once saved, with no second yes, it holds for every agent at the next check, History records who, what and why, and the reason reads beside the entry |
| AC-27.22 | An Admin | they ask to remove an entry and sign in again | *Who it changes* is read first; the removal reads *Waiting for a second Admin*, whatever the second-yes setting, the entry stays in force, and every other Admin finds it in *Needs you*; another Admin's yes, signing in again, removes it and the kind or property reads again for every agent allowed it; History names both. The asker's own *Approve* is refused, naming that another Admin approves; a decline keeps the entry |
| AC-27.23 | A property newly added to a model, or newly tagged personal or confidential in Meaning | an agent reads its kind | the property is read, since nothing hides a property automatically; it is hidden only once an Admin adds it |
| AC-27.24 | A person who holds Read on `access/policies` but not Manage on Access | they open *Hidden from agents* | the entries read; *Add an entry* and *Remove* are disabled, naming Manage on Access and who can grant it |
| AC-27.25 | A kind or property an entry hides, and a name that does not exist | each is looked up by an agent or any caller on any path — a typed plan, a write, search, a raw-text call, MCP, a key or the API | both fail with the same status, body, error order and timing; no log line or trace names the entry; a person with Read on `access/policies` sees which rule refused, in History |
| AC-27.26 | A person without Read on `access/policies` | they open an agent's page, its effective view, a check or a refusal, or ask for them from the API or the command line | no rule, policy or setter of *Hidden from agents* shows, and a refusal reads the check and who can grant it; with Read they read the rule, its policy and who set it |
| AC-27.27 | A graph database where the caller's policies hide anything — an entry, or the person's own Deny Read | a raw query is sent — in the Query console, an MCP raw-query tool or a key | it is refused with *Raw queries are not available on {graph database}*, the same sentence whatever hides, naming no kind and no rule; typed query plans still run there |
| AC-27.28 | An entry on a kind or a property | search, autocomplete or a vector or embedding query runs for an agent | the kind or property is never matched, scored, ranked or counted; copies made before the entry was added stay as they were |
| AC-27.29 | An agent made, an external agent registered, an MCP client connected or a worker runtime started | its ceiling is read | *Hidden from agents* is on it; a key reads under its owner and the agent it calls; nothing takes the policy off an agent |
| AC-27.30 | An entry on a kind or a property | the kind is renamed, aliased, written in another case or given an extra label | it stays hidden; the entry reads the current name |
| AC-27.31 | A person with Manage on Access but no Read on `access/policies` | they try to add or remove an entry | it is refused as *No access*, naming Read on `access/policies` and who can grant it |

## Screens

| Surface | Access | First use | Empty after a filter | Loading | Has data | Failed | Agent working or proposing | No access |
|---|---|---|---|---|---|---|---|---|
| Hidden from agents | Admin | settings.policies · Nothing hidden | — | settings.policies · Loading | settings.policies · Hidden from agents | settings.policies · Could not load | settings.policies · Hidden from agents · Waiting for a second Admin | — |
| An entry, added or removed | Admin | — | — | — | settings.policies · Hidden from agents · Who it changes | settings.policies · Hidden from agents · Entry refused | settings.policies · Hidden from agents · Waiting for a second Admin | — |
| Hidden from agents | Operator | — | — | — | — | — | — | settings.policies · No access |
| An entry, added or removed | Operator | — | — | — | — | — | — | settings.policies · No access |
