---
id: DA-18
title: Load a bundle as one run
feature: DA-F02
status: idea
personas: [modeller]
boards: [data.upload, agents.run]
---

# DA-18 · Load a bundle as one run

**As** a modeller whose nightly load spans several datasets that only make sense together **I want** one command and
one run for the whole bundle **so that** I read one outcome instead of correlating several, and links between models
resolve after every part of it has landed.

Tasks: [task.md](task.md) · Feature: [DA-F02](../../feature.md)

## Who can

| Lens | Can | Otherwise sees |
|---|---|---|
| Admin | Check and load any bundle; read its run | — |
| Operator | Check a bundle offline; read a bundle's run in the graphs they are in | Loading is refused before anything is written, naming who may load. With *Can shape the model*: loads it |

## Flow

```mermaid
flowchart LR
  a([import a bundle from the command line]) --> ck["Check: each dataset against its model, then the rules between them"]
  ck -->|a dataset malformed · a folder missing| x["Fails before writing — names the dataset and the check"]
  ck -->|clean| ld["Each dataset loads, several at once"]
  ld --> ok1["air-routes ✓"]
  ld --> ok2["news-articles ✓"]
  ld --> bad["twitter ✗ — breaks its model"]
  ok1 --> lk["Links between models resolve once, over everything that landed"]
  ok2 --> lk
  bad --> tk["A task: twitter feed broke its model — for its owner"]
  lk --> rep(["One run: 2 of 3 datasets loaded · counts per dataset"])
  tk --> rep
  ld -->|every dataset fails| all["Links skipped · the run fails with a diagnosis"]
```

## Acceptance criteria

| # | Given | When | Then |
|---|---|---|---|
| DA-18.1 | A bundle folder with its manifest | the person checks it offline | each dataset is checked against its own model first — ids unique, keys present and unique, every kind and property declared, values of the declared type and in range, relationships on the kinds they name — then each rule between datasets is resolved and counted by distinct key values |
| DA-18.2 | A rule between datasets that leaves values unresolved | it is checked | it fails, unless the rule says it is meant to overlap only partly; an end the bundle does not carry is reported as deferred, never failed |
| DA-18.3 | A bundle whose manifest names a folder that is not there, or a malformed dataset | it is loaded | it fails before anything is written, naming the dataset and the check |
| DA-18.4 | A clean bundle | it is loaded | it is one run; each dataset loads in parallel, up to the bundle's ceiling and the graph's capacity |
| DA-18.5 | One dataset of three that fails | the run ends | the other two stand, the failed one is reported with its reason, links between models resolve over what landed, and a task naming the dataset is raised for its owner — or left unassigned |
| DA-18.6 | Every dataset that fails | the run ends | resolving links is skipped and the run fails with a diagnosis, never an empty success |
| DA-18.7 | A bundle's run | it is listed in *Recent imports* | it is one row; opening it shows each dataset with its counts, and the task it raised links to its project |
| DA-18.8 | A cancelled bundle | the run stops | each dataset keeps what it wrote and the report says which had finished |
| DA-18.9 | A bundle loaded again | the run ends | records match by each model's keys and nothing duplicates |
| DA-18.10 | A bundle with a relationship file the graph has no active link between models for | it loads | that file is reported and nothing of it is written |
| DA-18.11 | A bundle's run | the person opens *How it got here* | the check, each dataset's load, the links and the report show as its steps |

## Screens

| Surface | Lens | First use | Empty after a filter | Loading | Has data | Failed | Agent working or proposing | No access |
|---|---|---|---|---|---|---|---|---|
| A bundle in recent imports | Admin | data.upload · No imports yet | data.upload · No imports match | data.upload · Imports loading | data.upload · Bundle | data.upload · Imports could not load | — | — |
| A bundle in recent imports | Operator | data.upload · No imports yet | data.upload · No imports match | data.upload · Imports loading | data.upload · Bundle | data.upload · Imports could not load | — | — |
| A bundle's run | Admin | — | — | agents.run · Bundle running | agents.run · Bundle | agents.run · Bundle partly failed | — | — |
| A bundle's run | Operator | — | — | agents.run · Bundle running | agents.run · Bundle | agents.run · Bundle partly failed | — | — |
