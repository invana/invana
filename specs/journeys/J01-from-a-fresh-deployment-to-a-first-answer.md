---
id: J01
title: From a fresh deployment to a first answer
personas: [admin, modeller]
stories: [AC-01, CP-22, CP-25, CP-17, CP-26, CP-27, SE-04, SE-06, SE-15, CP-39, CP-38, CP-24, SE-05, RC-08, RC-09, CP-01, AG-35, EX-01, EX-02, EX-04]
boards: [access.signin, start.home, settings.databases.connect, settings.databases.connect.files, settings.databases.connect.shape, settings.databases.connect.ready, settings.databases, start.setup, access.sign_in_again, model.board.draft.publish, data.upload, settings.ai, explore.ask, explore.board, explore.board.why]
---

# From a fresh deployment to a first answer

> **Priya**, the first Admin of a fresh deployment, has a decision to make; she wants her graph database connected
> and a first answer from it, every claim citing its record, without an engineer.

## The journey

```mermaid
flowchart TD
  A([The deployment runs · Priya's Admin account is made · J07]) --> B["AC-01 · Sign in"]
  B --> C["CP-22 · Home, first run: what are you trying to decide?"]
  C -->|Try it on demo data| SG(["Explore the demo graph database"])
  C -->|Connect a graph database| D{"Is its connector installed?"}
  D -->|no| D1["CP-17 · Not offered · names the package to install"] --> D
  D -->|yes| E["CP-25 · CP-26 · Connect a graph database · name · test · what is there"]
  E -->|the test fails| E1["The database's own words"] --> E
  E -->|it holds records| H["SE-04 · The agent drafts the model from the database's schema, never its records"]
  E -->|it is empty| H2["SE-06 · SE-15 · A description, a starter or an ontology"]
  E -->|it is empty, Priya has files| G["CP-27 · Drop files · each says what it becomes"]
  G -->|a column is unclear| G1["Asked, not guessed"] --> G
  G --> H
  H --> I{"Priya decides"}
  H2 --> I
  I -->|change| H
  I -->|accept| RD["CP-25 · Ready · read-only and off"]
  RD --> ON["CP-39 · Turn it on"]
  ON --> K["CP-24 · Set-up: what is left before the first answer"]
  K --> L["SE-05 · Review and publish the model"]
  L --> M{"Records in the graph database?"}
  M -->|already there| N
  M -->|from files| M1["RC-08 · Load a file into the model"]
  M1 -->|the graph database is read-only| M3["CP-38 · Refused, naming the mode · Priya signs in again and sets it read + write"] --> M1
  M1 --> M2["RC-09 · Each record checked · what does not fit is rejected, each named"]
  M2 --> N{"An AI model answers?"}
  N -->|none yet| N1["CP-01 · Add an AI model · local or external"] --> N
  N -->|yes| Q{"Is the Assistant among the agents she may use?"}
  Q -->|no| Q1["AG-35 · Grant the Assistant to herself, as an Admin"] --> Q
  Q -->|yes| O["EX-01 · Ask in plain words"]
  O --> P["EX-02 · The answer arrives on the board"]
  P --> R(["EX-04 · How it got here: the typed plan, the query per graph database, the records, the load"])
```

## Steps

| # | Step | Product · surface | Story | Board |
|---|---|---|---|---|
| 0 | The deployment is readied and Priya's Admin account made | Access Plane · Directory | [J07](J07-ready-a-deployment.md) | — |
| 1 | Sign in | Access Plane · Sign in, account and sessions | AC-01 | `access.signin` |
| 2 | Say what she is deciding; pick *Connect a graph database* | Control Plane · Graph databases — Home, first run | CP-22 | `start.home` |
| 3 | Name and connect the graph database — offered only if its connector is installed; the test says what is there | Control Plane · Graph databases | CP-25 · CP-26 · CP-17 | `settings.databases.connect` |
| 4 | Or, with an empty database: drop files; each says what it becomes | Control Plane · Graph databases | CP-27 | `settings.databases.connect.files` |
| 5 | The agent drafts the model; Priya accepts or changes it | Ontology · Start a model | SE-04 · SE-06 · SE-15 | `settings.databases.connect.shape` |
| 6 | Connect it — saved read-only and off — and turn it on | Control Plane · Graph databases | CP-25 · CP-39 | `settings.databases.connect.ready` · `settings.databases` |
| 7 | See what is left before the first answer | Control Plane · Graph databases › Set-up | CP-24 | `start.setup` |
| 8 | Review and publish the model | Ontology · Change and publish | SE-05 | `model.board.draft.publish` |
| 9 | Load records, when the database had none | Intelligence · Bring records in | RC-08 · RC-09 | `data.upload` |
| 10 | Ask the first question, through the Assistant | Evidence · Ask a question | EX-01 | `explore.ask` |
| 11 | Read the answer and how it got here | Evidence · The answer | EX-02 · EX-04 | `explore.board` · `explore.board.why` |

## Branches

| When | What happens | Story | Board |
|---|---|---|---|
| It needs permission | Priya is an Admin: every set-up act is hers. An Operator reaching set-up reads it, each step naming the role it needs | CP-24 | `start.setup` |
| It fails | A failed test names the database's own error; records that do not fit are rejected, each named | CP-26 · RC-09 | `settings.databases.connect` · `data.upload` |
| The person has no access | Without an account, the sign-in card reads *Ask your admin for an account* | AC-01 | `access.signin` |
| Her database's connector is not installed | It is not offered; the step names the package that adds it, installed on the engine's machine | CP-17 | `settings.databases.connect` |
| The database is empty | Drafting is offered disabled with its reason; a description, a starter or an ontology starts the model | CP-26 · SE-06 · SE-15 | `settings.databases.connect.shape` |
| The graph database is read-only | Loading files is refused, naming the mode; an Admin signs in again and sets it read + write, recorded in History | RC-08 · CP-38 | `data.upload` · `access.sign_in_again` |
| No AI model is offered | Asking is disabled with its reason; an Admin adds one, marked local or external | CP-01 | `settings.ai` |
| The Assistant is not among her agents | Asking names it; as an Admin she grants it | AG-35 | — |
| A property is sensitive and the AI model external | The call is refused before it leaves, naming the property; the answer says what it could not use | EX-04 | `explore.board.why` |
| She only wants to look | *Try it on demo data* opens Explore on the demo graph database | CP-22 | `start.home` |

## Done when

- The deployment answers Priya's first question on the board, and *How it got here* shows the typed plan, the query sent to each graph database, the records and the load behind them.
- Set-up reads every step done and steps aside.
