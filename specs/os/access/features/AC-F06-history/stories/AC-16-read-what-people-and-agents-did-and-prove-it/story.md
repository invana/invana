---
id: AC-16
title: Read what people and agents did, and prove it
feature: AC-F06
status: idea
personas: [admin, builder, analyst]
boards: [inbox.history, agents.run]
---

# AC-16 · Read what people and agents did, and prove it

**As** an Admin answering for what the deployment did **I want** every act by a person or an agent — by row, by
actor, by record and by refusal — in a record I can export and prove nobody edited **so that** access is proven, not
assumed, and an audit is a filter rather than a hunt.

Tasks: [task.md](task.md) · Feature: [AC-F06](../../feature.md)

## Who can

| Lens | Can | Otherwise sees |
|---|---|---|
| Admin | Read every row, the counts over the deployment, by actor, by record and refusals; a row's arguments when they may read its run; export | — |
| Operator | Read their own acts and the rows of runs they may read, with the filters; export those rows | The rest is counted, not shown: *N rows today belong to runs you cannot read — counted, not shown*; the counts over the deployment are not shown |

## Flow

```mermaid
flowchart LR
  s([Inbox › History]) -->|nothing yet| e["No acts yet"]
  s --> r["Rows, today: when · who ▸ through which agents · act · touched · allowed or refused · run"]
  r -->|Everything · People · Agents · Refused · window| f{"Matches?"}
  f -->|no| z["0 of N match · Clear all"]
  r -->|a row| d["Chain of custody · the act and its rule · hash and previous · the acts around it"]
  d -->|Open the step| run(["The run's sheet, on that step"])
  r -->|a person or agent| a["Their acts, writes, refusals, and the helpers they acted through"]
  r -->|a record| rec["Every act on it · who can see it now"]
  r -->|Export| x(["CSV or JSON Lines, with each row's hash"])
  s -->|chain broken| b["Broken at row N · rows still read"]
  s -->|after a prune| cp["Verified from the checkpoint of the last prune"]
```

## Acceptance criteria

| # | Given | When | Then |
|---|---|---|---|
| AC-16.1 | Nothing has happened in the deployment | History opens | it reads *No acts yet — a run or a person's act writes the first row* |
| AC-16.2 | Acts today | History opens | rows read newest first: when · who, with the chain they acted through (*Sam ▸ Reporting agent ▸ Order checker*) · the act · what it touched · allowed, refused, waiting on an ask or held · the run |
| AC-16.3 | An agent acting for a person | its row is read | both are named, apart — never one name for both |
| AC-16.4 | A step an agent took, a step it was refused, a helper it started, and a person who published, stopped a run, decided an ask or saved a policy | History is read | each is one row, in the deployment's one chain |
| AC-16.5 | A refused act | its row is read | it names the reason — the role · may not use the agent · an Access Policy rule · switched off · a read-only graph database · a sensitive property · over a limit · the site's robots.txt — and the rule in words, with its policy |
| AC-16.6 | History | the reader picks *People*, *Agents* or *Refused*, or a window — today · last 24 hours · 7 days · 30 days · any time | only those rows list, the filter shown with a way to clear it; with no window chosen it reads today |
| AC-16.7 | Filters that match nothing | History is read | it reads *0 of N match*, with *Clear all* |
| AC-16.8 | A row | the reader opens it | its detail opens beside the list: who started it and each agent with how it got there, the function and its version, where it ran · the act, its arguments and the rule that allowed or refused it, its policy and version · its hash, the previous hash and whether the chain held · the acts around it |
| AC-16.9 | A row from a run | the reader presses *Open the step* | the run's sheet opens on that step |
| AC-16.10 | A person or an agent and a window | By actor is read | it counts their acts, writes, outside reads, secrets used and refusals, and lists the helpers they acted through, one kind grouped as *Order checker ×4* |
| AC-16.11 | A record's address and a window | By record is read | it lists every act on that record, counts reads, writes, refusals, people and agents, and says which agents may read and write its kind now, and for which teams |
| AC-16.12 | Refusals | they are read | refused today as a share of all acts, counts by reason, refused a day over 30 days, the most refused functions, and each rule that held |
| AC-16.13 | The rows shown | the reader presses *Export* and picks CSV or JSON Lines | a file of exactly those rows downloads, each with its hash and the previous one, and the export is listed with who made it |
| AC-16.14 | No rows match | *Export* is reached | it is disabled, reading *no rows match* |
| AC-16.15 | The head | it is read | it says History is unedited, when the chain was last checked, how long rows are kept — *Kept until an Admin sets a period* by default (AC-44) — and *On hold* when History is held |
| AC-16.16 | A row changed outside Invana | the chain is next checked | the head reads *broken at row N* in red; rows still read |
| AC-16.17 | A credential used by an act | its row is read | the secret is named, never its value; it never entered the record |
| AC-16.18 | A row about a record since deleted | it is read | it names the record as it was |
| AC-16.19 | Rows older than the period an Admin set | they are removed | a whole window goes, never chosen rows; the removal is itself a row, and a signed checkpoint keeps the number and hash of the last row removed |
| AC-16.20 | An Operator or a Modeller | they open History | they read their own acts and the rows of runs they may read (AC-31); a line counts the rest, *counted, not shown*; the counts over the deployment are not shown |
| AC-16.21 | An Operator or a Modeller | they follow a link to a row they cannot see | it reads *not found* |
| AC-16.22 | The engine cannot read History | it opens | it says what it could not read, with *Try again* |
| AC-16.23 | A call through a key or an MCP client | its row is read | it is named as outside, with the key's or the client's name and the person it acts as |
| AC-16.24 | Rows arriving while History is open | the reader is on the first page | new rows join the top without moving the rows below |
| AC-16.25 | A row the reader may see, of a run they may not read — an Admin included | its detail opens | who, the act, the verdict and the rule read; its arguments read *withheld — only {person behind}, or someone whose agent may read its sources, reads them* (AC-31) |
| AC-16.26 | History pruned at least once | the chain is checked | it verifies from the latest checkpoint — its signature, and the first kept row following the last removed one; the head names the checkpoint's date |
| AC-16.27 | A checkpoint whose signature or link does not hold | the chain is next checked | the head reads *broken at the checkpoint of {date}* in red; rows still read |
| AC-16.28 | History on legal hold | its period passes | no row is removed until the hold is lifted (AC-44) |
| AC-16.29 | A row naming a person who left while names are pseudonymised | it is read or exported | it names them by their code (AC-45); its hash still verifies |

## Screens

| Surface | Lens | First use | Empty after a filter | Loading | Has data | Failed | Agent working or proposing | No access |
|---|---|---|---|---|---|---|---|---|
| History — rows | Admin | inbox.history · No acts yet | inbox.history · Nothing matches | inbox.history · Loading | inbox.history · Everything | inbox.history · Chain broken | inbox.history · Agents | — |
| The head after a prune | Admin | — | — | — | inbox.history · From a checkpoint | inbox.history · Checkpoint broken | — | — |
| The head after a prune | Operator | — | — | — | inbox.history · From a checkpoint | inbox.history · Checkpoint broken | — | — |
| History — rows | Operator | inbox.history · No acts yet | inbox.history · Nothing matches | inbox.history · Loading | inbox.history · Counted, not shown | inbox.history · Chain broken | inbox.history · Agents | inbox.history · Counted, not shown |
| A row's detail | Admin | — | — | inbox.history · Loading | inbox.history · Row | inbox.history · Could not load | — | — |
| A row's detail | Operator | — | — | inbox.history · Loading | inbox.history · Row | inbox.history · Could not load | — | inbox.history · Arguments withheld |
| By actor · by record · refusals | Admin | inbox.history · No acts yet | inbox.history · Nothing matches | inbox.history · Loading | inbox.history · Refused | inbox.history · Could not load | — | — |
| By actor · by record · refusals | Operator | — | — | — | — | — | — | inbox.history · Counted, not shown |
| Export | Admin | — | inbox.history · Nothing to export | — | inbox.history · Export | inbox.history · Could not load | — | — |
| Export | Operator | — | inbox.history · Nothing to export | — | inbox.history · Export | inbox.history · Could not load | — | inbox.history · Export |
| The step a row opens | Admin | — | — | agents.run · Loading | agents.run · Step | agents.run · Failed | — | — |
| The step a row opens | Operator | — | — | agents.run · Loading | agents.run · Step | agents.run · Failed | — | agents.run · Not found |
