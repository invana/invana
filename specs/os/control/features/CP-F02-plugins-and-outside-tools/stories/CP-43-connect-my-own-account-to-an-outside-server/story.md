---
id: CP-43
title: Connect my own account to an outside server
feature: CP-F02
status: idea
personas: [analyst, builder, admin]
boards: [settings.me, settings.people, access.sign_in_again, access.locked]
---

# CP-43 · Connect my own account to an outside server

**As** an analyst or agent builder **I want** to connect my own account on an outside server that lets people connect
their own — a personal connection — and disconnect it whenever I choose **so that** agents in the runs I start reach
that service as me and see only what I may see there, and nobody else's work reaches it as me.

Tasks: [task.md](task.md) · Feature: [CP-F02](../../feature.md)

## Who can

Roles are [the role table](../../../../../access/features/AC-F02-access-policies/feature.md#the-role-table).

| Lens | Can | Otherwise sees |
|---|---|---|
| Admin | Connect and disconnect their own personal connections; read every person's personal connections and disconnect any — each with the password again | — |
| Operator | Connect and disconnect their own personal connections, with the password again; a Modeller the same | Another person's personal connections are absent. A service user has no personal connection |

## Flow

```mermaid
flowchart TD
  s([Settings › You › Personal connections]) --> l["Each server that lets people connect their own · connected or not"]
  l -->|Connect · password again| go["The server's own sign-in and consent"]
  go -->|the person allows| ok(["Connected · the account's name · History"])
  go -->|denied or failed| nf(["Not connected · says what the server answered"])
  ok --> use{"A step of a run I started calls the server, and its agent has no work connection there"}
  use -->|connected| call(["Called as me · recorded (CP-63)"])
  use -->|not connected or expired| ref(["Refused before the call · Connect your account · an Inbox row"])
  ok -->|the server stops renewing it| exp(["Expired · Reconnect · an Inbox row"])
  ok -->|Disconnect · password again| dc(["Removed · the next call is refused"])
  a([People and access › Personal connections]) -->|Admin| all(["Every person's personal connections · Disconnect any"])
```

## Acceptance criteria

| # | Given | When | Then |
|---|---|---|---|
| CP-43.1 | A person and servers that let people connect their own | they open *Personal connections* | each such server reads, connected — with the account's name, when and last used — or not, with *Connect*; *No accounts connected* when none is |
| CP-43.2 | A person | they press *Connect* and give their password | their browser goes to the server's own sign-in with PKCE, naming the server as the resource |
| CP-43.3 | The person allows on the server | the server sends them back | the account is connected, its tokens sealed; History records who connected which server, never a token |
| CP-43.4 | The person denies, or the server answers with an error | they come back | nothing is connected, and the page says what the server answered |
| CP-43.5 | A run the person started, whose agent has no work connection on that server, and no personal connection of theirs there | a step calls one of its tools | the step is refused before the call, telling the person to connect their account, and they get an Inbox row with *Connect* |
| CP-43.6 | A connected personal connection | a step of a run the person started, or of its helper, calls the server and the agent has no work connection there | the call is made as that account, renewed first when its access token has run out, and *What left the platform* names the personal connection |
| CP-43.7 | An account the server stops renewing | a renewal is refused | it reads *Expired* with *Reconnect*; the person gets an Inbox row; their calls are refused until they reconnect |
| CP-43.8 | A service user's run, a schedule or a picked-up task | a step calls a server whose agent has no work connection there | it is refused before the call; no personal connection is used (CP-63.4) |
| CP-43.9 | Connecting or disconnecting | it is done without the password, with a wrong one, or with a key | it is refused — *Enter your password again to do this* |
| CP-43.10 | A person | they disconnect their account | it is removed at once; the next call for their runs is refused as in CP-43.5; History records it |
| CP-43.11 | An Admin | they open *People and access › Personal connections* and disconnect a person's account with their password | it is removed; the person is told in the Inbox; History names the Admin |
| CP-43.12 | An Operator | they read another person's account by any path | it is absent (`404`) |
| CP-43.13 | A person deactivated (AC-23) | it is done | every personal connection of theirs is disconnected |

## Screens

| Surface | Lens | First use | Empty after a filter | Loading | Has data | Failed | Agent working or proposing | No access |
|---|---|---|---|---|---|---|---|---|
| Your personal connections | Admin | settings.me · No accounts connected | — | settings.me · Loading | settings.me · Personal connections | settings.me · Account expired | — | — |
| Your personal connections | Operator | settings.me · No accounts connected | — | settings.me · Loading | settings.me · Personal connections | settings.me · Account expired | — | — |
| Connect | Admin | — | — | settings.me · Connecting | settings.me · Account connected | settings.me · Not connected | — | — |
| Connect | Operator | — | — | settings.me · Connecting | settings.me · Account connected | settings.me · Not connected | — | — |
| Every person's personal connections | Admin | settings.people · No accounts connected | settings.people · Nothing matches | settings.people · Loading | settings.people · Personal connections | settings.people · Could not load | — | — |
| Every person's personal connections | Operator | — | — | — | — | — | — | access.locked |
| Password again | Admin | — | — | access.sign_in_again · Checking | access.sign_in_again | access.sign_in_again · Wrong password | — | — |
| Password again | Operator | — | — | access.sign_in_again · Checking | access.sign_in_again | access.sign_in_again · Wrong password | — | — |
