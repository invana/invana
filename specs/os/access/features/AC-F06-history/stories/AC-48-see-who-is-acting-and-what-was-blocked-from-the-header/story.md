---
id: AC-48
title: See who is acting and what was blocked, from the header
feature: AC-F06
status: idea
personas: [admin]
boards: [shell.access, shell.avatar.access]
---

# AC-48 · See who is acting and what was blocked, from the header

**As** an Admin **I want** one glance from any screen at who and which agents are acting now, on whose behalf, what a
policy stopped today and what acts for a person until when **so that** I catch access going wrong while it happens and
end it in one click.

Tasks: [task.md](task.md) · Feature: [AC-F06](../../feature.md)

## Who can

| Lens | Can | Otherwise sees |
|---|---|---|
| Admin | Open the Access dropdown: every tile and section; open a blocked act's policy; *Revoke* a delegation with the password again; open the Inbox and Settings › Access › History from it | — |
| Operator | Operator · Modeller: read their own roles and delegations under *Your access* in the avatar menu; revoke their own | No *Access* button in the header — it is absent, not disabled |

## Flow

```mermaid
flowchart TD
  h([The header lock · Admin only]) --> d["Access dropdown"]
  h -->|an act was blocked today| cnt["The lock carries the count"]
  d -->|loading| ld["Tiles and sections drawn at once · fill in place"]
  d -->|could not load| fl["What could not be read · Try again"]
  d --> t["Tiles: people signed in · agents acting now · requests waiting · blocked acts today"]
  t -->|requests waiting| ib(["The Inbox (CP-69) · requests stay there"])
  d --> an["Acting now · each person and agent · on whose behalf · role · last touched"]
  d --> bl["Blocked today · each act a policy stopped"] -->|an act| pol(["Its Access Policy (AC-03)"])
  d --> dl["Delegations in force · a client or key acting for a person · role · ends in"]
  dl -->|Revoke| cf["Confirm · names what ends · its runs going"] --> pw{"Password again"}
  pw -->|right| rv(["Revoked · its runs stop · its owner told · History records it"])
  pw -->|wrong| no["Enter your password again to do this"]
  d --> rc["Recent changes · grants · invites · policy edits"] -->|All| hi(["Settings › Access › History (AC-16)"])
  d -->|nothing today| calm["Nobody blocked today · nothing waiting"]
  o([An Operator · the avatar menu]) --> ya["Your access · my role · my delegations"]
  ya -->|Revoke my own| rv
```

## Acceptance criteria

| # | Given | When | Then |
|---|---|---|---|
| AC-48.1 | An Admin | the header is read | it shows the *Access* lock; the lock carries a count only when an act was blocked today, the engine's |
| AC-48.2 | An Operator or a Modeller | the header is read | there is no *Access* button |
| AC-48.3 | An Admin | they click the lock | the Access dropdown opens anchored to it, no scrim; outside click or Esc closes it |
| AC-48.4 | The dropdown | its tiles are read | people signed in · agents acting now · requests waiting · blocked acts today — each as the engine counted it |
| AC-48.5 | Requests waiting | the Admin picks the tile | the Inbox dropdown opens (CP-69); the requests are decided there, never in Access |
| AC-48.6 | People and agents acting | *Acting now* is read | each person's session and each agent's run going, with on whose behalf, its role and when it last acted — *now* · *within 15 min* · *today*, counted from writes and runs only; never where or from which device |
| AC-48.7 | Acts a policy refused today | *Blocked today* is read | each act with who, through which agent, what it touched and the rule that stopped it; picking one opens its Access Policy (AC-03) |
| AC-48.8 | A connected client or a key acting for a person, or a key of a service user | *Delegations in force* is read | each with the person or service user it acts for — a service user's with its owners — the role and when it ends; a key with no expiry is marked *Never* |
| AC-48.9 | A delegation in force | the Admin presses *Revoke* and enters the password | it ends at once and leaves the list; its queued and running runs stop; History records who revoked it and each run stopped; its owner gets an Update in the Inbox naming it and the Admin ([AC-10](../../../AC-F10-keys/stories/AC-10-mint-a-key-that-acts-as-its-owner-narrowed/story.md) · [AC-36](../../../AC-F11-connect-an-mcp-client/stories/AC-36-see-and-revoke-connected-clients/story.md)) |
| AC-48.10 | *Revoke* | the password is wrong or missing | it is refused — *Enter your password again to do this.* — and nothing ends |
| AC-48.11 | Grants, invites and policy edits | *Recent changes* is read | the newest, each with who and when; *All* opens Settings › Access › History (AC-16) |
| AC-48.12 | Nothing blocked and nothing waiting today | the dropdown opens | it reads *Nobody blocked today* and the tiles read their counts |
| AC-48.13 | The lists still loading | the dropdown opens | tiles and sections draw at once and fill in place |
| AC-48.14 | The engine cannot read the summary | the dropdown opens | it says what it could not read, with *Try again* |
| AC-48.15 | Anyone but an Admin | they call the access summary | it is refused *This needs the Admin role.* |
| AC-48.16 | An Operator | they open *Your access* in the avatar menu | their role, the agents they may use, and the clients and keys acting for them with when each ends, each with *Revoke* |
| AC-48.17 | An agent acting now | the Admin opens it | *How it got here* shows its run's steps and sources, its content as AC-31 allows |
| AC-48.18 | An Admin's tab holding the counts stream | their role is taken away, their account is deactivated, or they sign out everywhere | within 2 seconds the stream closes; no deployment count reaches that tab again |
| AC-48.19 | A key, a connected client's token, or a token in the address | the counts stream is opened with it | it is refused — only a person's session, sent in the `Authorization` header, opens it |
| AC-48.20 | A session with 10 counts streams open, or an account with 20 | one more is opened | it is refused — *Too many open tabs — close one and try again.* |
| AC-48.21 | A client, key, agent or rule name, or what an act touched | the dropdown is read | it reads as text on one line, cut short where it overflows; a self-registered client reads *Unverified* with the host it returns to |
| AC-48.22 | An Admin | they open the dropdown | History records that they read the access summary — once per Admin per hour |
| AC-48.23 | The access summary | it is called with a `tz` that is not an IANA zone | it is refused — *tz: {value} is not a time zone.* |
| AC-48.24 | *Revoke* on a delegation | the confirm opens | it names the client or key, who it acts for, and how many of its runs going will stop |

## Screens

| Surface | Lens | First use | Empty after a filter | Loading | Has data | Failed | Agent working or proposing | No access |
|---|---|---|---|---|---|---|---|---|
| The Access dropdown | Admin | shell.access · Nobody blocked today | — | shell.access · Loading | shell.access | shell.access · Could not load | shell.access · Agents acting | — |
| The Access dropdown | Operator | — | — | — | — | — | — | shell.access · No button |
| Revoke a delegation | Admin | — | — | — | shell.access · Revoke | shell.access · Password refused | — | — |
| Revoke a delegation | Operator | — | — | — | — | — | — | — |
| Your access | Admin | shell.avatar.access · Nothing acts for you | — | shell.avatar.access · Loading | shell.avatar.access | shell.avatar.access · Could not load | — | — |
| Your access | Operator | shell.avatar.access · Nothing acts for you | — | shell.avatar.access · Loading | shell.avatar.access | shell.avatar.access · Could not load | — | — |
