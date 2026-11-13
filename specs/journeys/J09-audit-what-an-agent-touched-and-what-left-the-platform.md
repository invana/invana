---
id: J09
title: Audit what an agent touched and what left the platform
personas: [admin, builder]
stories: [AC-13, CP-50, RC-06, AC-12, AC-06, AC-16, AC-17]
boards: [settings.access, agents.run, data.record]
---

# Audit what an agent touched and what left the platform

> **Lee**, an Admin, must answer an auditor: what has this agent read, written and run, for whom — and what went to
> which AI model or tool, carrying what — with proof nobody altered the record.

## The journey

```mermaid
flowchart TD
  A([Access Plane]) --> U["Access usage · what the agent read, wrote and ran — kinds, counts, graph databases, for whom"]
  U --> P["AC-13 · What it can do, beside what it used"]
  P -->|access it never used| N["AC-06 · Narrow its Access Policy · see who it changes"]
  U --> O["What left the platform · every call to an AI model or tool — schema-only or data-bearing"]
  O --> O1{"A call to look at"}
  O1 -->|data-bearing, to an external model| O2["The kinds, fields and record IDs it carried · the model · the run · the person behind"]
  O1 -->|refused| O3["A sensitive property never sent · named"]
  O2 --> R["CP-50 · Open the run behind it"]
  R -->|Lee may read it| R1["Its steps, queries, records and calls"]
  R -->|the run is not hers to read| R2["That it ran, its status and its cost — content withheld"]
  R1 --> RC["RC-06 · A record it wrote: every change to it, and the run behind each"]
  R1 --> W["AC-12 · Why it could or could not, step by step"]
  W --> H["AC-16 · History: what people and agents did · prove the chain is unbroken"]
  RC --> H
  N --> H
  O3 --> H
  H --> C["AC-17 · Compare two versions of the policy, agent or workflow"]
  C --> E(["An export of the History rows, with their hashes, for the auditor"])
  A -.->|without the Admin role| NA(["Each person reads the usage and calls of runs they may read · a Modeller reads unused access"])
```

## Steps

| # | Step | Product · surface | Story | Board |
|---|---|---|---|---|
| 1 | Read what the agent read, wrote and ran, for whom | Access Plane · Access usage | — | — |
| 2 | Compare what it can do with what it used | Access Plane · What an agent may touch | AC-13 | `settings.access` |
| 3 | Narrow access it never used, seeing who it changes | Access Plane · Access Policies | AC-06 | `settings.access` |
| 4 | Read every call to an AI model or tool, schema-only or data-bearing | Access Plane · What left the platform | — | — |
| 5 | Open the run behind a call | Control Plane · Runs | CP-50 | `agents.run` |
| 6 | Open a record the agent wrote and every change to it | Intelligence · Provenance | RC-06 | `data.record` |
| 7 | Read why each step could or could not act | Access Plane · What an agent may touch | AC-12 | `agents.run` |
| 8 | Prove the History chain is unbroken | Access Plane · History | AC-16 | `settings.access` |
| 9 | Compare two versions of what changed | Access Plane · History | AC-17 | `settings.access` |

## Branches

| When | What happens | Story | Board |
|---|---|---|---|
| It needs permission | Run content is readable by the person behind it and, for a project's run, by anyone whose default agent may see its sources — a role adds nothing; everyone else sees that it ran, its status and its tokens | CP-50 | `agents.run` |
| It fails | A History chain that does not verify names the first row that breaks it | AC-16 | `settings.access` |
| The person has no access | An Operator or a Modeller reads the usage and calls of runs they may read; only an Admin reads every run's | AC-13 | `settings.access` |
| A sensitive property met an external model | The call was refused before it left, naming the property; the refusal is in the ledger and History | — | — |
| A schema-only workflow sent data | An ops alert names the run and what it carried | — | — |

## Done when

- For one agent, Lee can show the auditor every read, write and run, every call that left the platform with what it carried, and the run and person behind each — and History proves none of it was altered.
