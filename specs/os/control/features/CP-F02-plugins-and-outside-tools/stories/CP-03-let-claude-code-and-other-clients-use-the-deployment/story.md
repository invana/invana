---
id: CP-03
title: Let Claude Code and other clients use the deployment
feature: CP-F02
status: idea
personas: [builder, curator, analyst, admin]
boards: [settings.mcp, settings.me]
---

# CP-03 · Let Claude Code and other clients use the deployment

**As** an agent builder or data curator **I want** Claude Code, an IDE or a script to check records, load records and
ask an agent through the deployment's one MCP server, through my default agent **so that** data arrives without
Invana pulling it, a client never reaches more than my default agent may, nothing confidential or personal leaves to
it, and every load is checked and can be undone.

Tasks: [task.md](task.md) · Feature: [CP-F02](../../feature.md)

## Who can

The permission each act needs is in [the permission catalogue](../../../../../access/features/AC-F02-access-policies/feature.md#the-permission-catalogue).

| Access | Can | Otherwise sees |
|---|---|---|
| Admin | With Manage on `plugin/<name>`: serve or stop serving an agent or a record tool; read the address, how to connect and every call | — |
| Operator | Read the address, what is served and how to connect; call the server through their default agent with a key of their own (AC-F10); read their own calls | The served switches read, naming the permission — *Needs Manage on the {name} plugin — ask {who can grant}*; another person's calls are absent |

## Flow

```mermaid
flowchart TD
  s([Settings › Connections › MCP server]) --> w["Address · what it serves · How a client connects"]
  w -->|Admin| on(["Serve or stop serving an agent · Check records · Load records"])
  w -->|not an Admin| dis["Switches read · naming the Admins"]
  w --> hc["How a client connects · the command with a key"]
  hc -->|no key yet| nk(["New key · AC-10 · then back here"])
  hc -->|a key| c
  c([A client with the command]) --> v{"A live key?"}
  v -->|no key · revoked · expired| r1(["401 · names how to connect with a key"])
  v -->|yes| ls["Lists what is served, granted to the person and within the default agent's reach"]
  ls --> call{"The default agent and the served agent may both make this call?"}
  call -->|no| r2(["Refused · names the rule · recorded"])
  call -->|yes| run(["A run for the person: the default agent, then the served agent as its helper"])
  run -->|check records| ck(["Valid · rejected, each named · nothing written"])
  run -->|load records| dr{"A read + write graph database · Write allowed?"}
  dr -->|no| df(["The run fails, naming why"])
  dr -->|yes| dv(["A load · checked against the model · rejected record by record"])
  run --> out{"The result carries a confidential or personal value?"}
  out -->|yes| lo(["Leaves without it · names what was left out · AC-42"])
  out -->|no| rc["Recent calls shows it"]
  lo --> rc
```

## Acceptance criteria

| # | Given | When | Then |
|---|---|---|---|
| CP-03.1 | A signed-in person | they open *MCP server* | its address, *How a client connects* — the command for Claude Code, an IDE or a script with a key (AC-10) — what it serves with a switch each, and their recent calls read |
| CP-03.16 | A person with no live key | they read *How a client connects* | it says a client connects with a key and offers *New key*, which opens AC-10's New key and returns here with the key in the command |
| CP-03.17 | An Admin on *How a client connects* with no key yet | they press *Make a key* | *New key* opens (AC-10) and, once the key is made, returns to *With a key* with the address and the header the client needs |
| CP-03.2 | Nothing served yet | the page opens | every agent and record tool that may be served lists with its switch off, and recent calls says *No calls yet* with how to connect |
| CP-03.3 | An Admin | they serve an agent or a record tool | a caller lists it from their next call, if it is granted to the person and within their default agent's reach — an agent as `ask_<agent>`, *Check records* and *Load records* by their tool names |
| CP-03.4 | An agent that is paused, retired or a draft | the served list is read, or a call reaches it | it cannot be served; a call to it is refused, naming its status |
| CP-03.5 | No key, or a revoked or expired one | a client calls | it is refused, naming how to connect with a key, and nothing is listed |
| CP-03.6 | A call the person may not make — an agent not granted to them, or a rule of the default agent or the served agent that does not allow it | it is made | it is refused, naming the rule; History records the refusal; no run opens |
| CP-03.7 | An allowed call | it is made | it is a run for the key's owner, whose chain is their default agent and then the agent the tool runs as, so the strictest rule of both wins; recorded with the tool and the key; the key's narrowing holds (AC-F10) |
| CP-03.8 | *Check records* | it runs | it returns which records are valid and which are rejected, each with its reason, and writes nothing |
| CP-03.9 | *Load records* into a read + write graph database whose kind both the default agent and the Loader may write | it runs | it is a load (RC-F02): records that hold land, records that break a rule are rejected each with its reason, and the caller gets the load's id, content hash and counts |
| CP-03.10 | *Load records* into a read-only graph database, or where the default agent or the Loader has no Write on that kind | it runs | the run fails, naming the graph database or the rule; nothing is written |
| CP-03.11 | An answer to an outside caller | it returns | every record carries where it came from; what the default agent may not read is withheld and counted, never silently left out; a confidential or personal value is left out and named, since a client is external (AC-42) |
| CP-03.12 | A call carrying a session its credential did not open, or a protocol version other than the pinned one | it is made | it is refused, saying which |
| CP-03.13 | An Operator | they open *MCP server* | everything they may read reads; the served switches are disabled, naming the Admins; a serve through the API is refused |
| CP-03.14 | A call | its run settles | recent calls shows when, the person, the key, the tool, its one-line result as the engine stored it, and the run — to that person and to the Admins |
| CP-03.15 | Any call | it is made | History records what it read and wrote, naming the person and the key (AC-F06 · AC-F09) |

## Screens

| Surface | Access | First use | Empty after a filter | Loading | Has data | Failed | Agent working or proposing | No access |
|---|---|---|---|---|---|---|---|---|
| MCP server | Admin | settings.mcp · Nothing served | — | settings.mcp · Loading | settings.mcp | settings.mcp · Could not load | — | — |
| MCP server | Operator | settings.mcp · Nothing served · Read only | — | settings.mcp · Loading | settings.mcp · Read only | settings.mcp · Could not load | — | settings.mcp · Read only |
| How a client connects | Admin | settings.mcp · How a client connects · No key yet | — | — | settings.mcp · How a client connects · With a key | settings.mcp · How a client connects · Key refused | — | — |
| How a client connects | Operator | settings.mcp · How a client connects · No key yet | — | — | settings.mcp · How a client connects · With a key | settings.mcp · How a client connects · Key refused | — | — |
| Recent calls | Admin | settings.mcp · No calls yet | settings.mcp · Nothing matches | settings.mcp · Loading | settings.mcp · Recent calls | settings.mcp · Call refused | — | — |
| Recent calls | Operator | settings.mcp · No calls yet | settings.mcp · Nothing matches | settings.mcp · Loading | settings.mcp · My calls | settings.mcp · Call refused | — | — |
| Make a key for a client | Admin | — | — | — | settings.me · New key | — | — | — |
| Make a key for a client | Operator | — | — | — | — | — | — | settings.mcp · Read only |
