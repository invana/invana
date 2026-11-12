---
name: system-design
description: Write or change Invana's system design — the one file specs/system-design.md (the high-level design and the non-functional requirements) and each feature's ## Engine section (its low-level design). Use whenever a spec's System impact is not "none", when an NFR, a component, a store, an API convention, a queue, an agent mechanism or a trust boundary changes, and when reviewing whether a build fits the design. Loaded with product-spec; never instead of it.
---

# System design — how the technology delivers the stories

The procedure the **product manager** follows; the coder, QA and security read what it produces and raise anything
they would change with the `recommend` skill. The stories say **what** a person can do (functional requirements); this
skill writes **how well** (non-functional requirements) and **how** (the design). The template is `template.md` beside
this file — copy it, never write from a blank page.

## 0. Where each fact lives

| Level | Holds | Home |
|---|---|---|
| Functional requirement | What a person or agent can do, each refusal they can see | A story's acceptance criteria (`product-spec`) |
| Non-functional requirement | How well: a number, how it is measured, what enforces it | `specs/system-design.md` § 3 |
| High-level design (HLD) | Context, constraints, estimates, stores, components, conventions, distributed execution, agents, failure modes, qualities, delivery, evaluation | `specs/system-design.md` |
| Low-level design (LLD) | One feature's records, routes, payloads, events, refusals, CLI and mechanisms | That feature's `feature.md` › `## Engine` |

| Rule | Detail |
|---|---|
| One home per fact | A record, route or event has one owning feature; every other feature links to it. `system-design.md` states conventions and links to the LLD; it never restates a table or a payload |
| HLD is a decision, not a lesson | Each section states Invana's choice and its trade-off in a few lines. A topic with no decision is one row: *N/A — why* |
| Scale is Invana's, not the web's | Estimates count graph size, concurrent runs, run length (hours, waiting on a person), tokens and storage growth — not users or QPS |
| An NFR is a number | Never "fast" or "secure": a target, how it is measured, and the check that enforces it (a test, a CI gate, an eval) — or `review` until one exists, which is a `recommend` row |
| The outside is named | What Invana guarantees vs what it inherits from the customer's graph database, LLM provider and MCP servers |
| Present tense, no history | No decision ids, no renames, no "used to". A change not yet made is a row in `specs/migrations.md` |
| Diagrams are mermaid | C4 context and container as `flowchart`; timing as `sequenceDiagram`; data as `erDiagram` |

## 1. Read

`specs/system-design.md` whole, the feature's `feature.md` and its stories, `specs/vision.md`, and the code the change
touches (read-only) when the design must match what exists.

## 2. Decide the System impact

Every feature's `## System impact` names what the change does to the HLD. Ask, in the spec interview:

| Question | If yes |
|---|---|
| Does it add or change a stored record, route, event, refusal or CLI command? | Its `## Engine` (LLD) |
| Does it add a store, a service, a queue, a worker kind, a cache or an outside system? | `system-design.md` §§ 6–9, and the § 4 constraint it may break |
| Does it touch an NFR — latency, throughput, scale, availability, cost in tokens, security, privacy, accessibility? | § 3 row(s) named in the feature's `nfrs:`; § 14 Evaluation rows for them |
| Does it cross a trust boundary — an LLM, a plugin, an outside database, another Graph? | § 12 Security and Privacy; security's threat model |
| Does it add an agent mechanism — a loop, a tool, an evaluator, a budget? | § 10 AI and agents |

None → `## System impact` reads `None`. Any → the impact table, and the sections changed in the same change as the spec.

## 3. Write

| Thing | How |
|---|---|
| An NFR | One row in § 3: `NFR-<PILLAR>-<n>` · the quality · target · measured by · enforced by · stories it constrains. Pillars: `REL` reliability · `SEC` security · `PERF` performance · `COST` tokens and resources · `OPS` operability · `SUS` sustainability · `UX` accessibility and usability. An ID is never reused |
| A section | Its decision table: *Decision* · *Choice* · *Trade-off* · *Detail in* (a feature's `## Engine` or N/A) |
| An LLD | The feature's `## Engine`: *Records* · *Routes* · *Events* · *Refusals* · *CLI* · *Mechanisms*, each a table. A record another feature reads is linked, not copied. Every refusal (status and its sentence) is also a criterion in the story where a person meets it |
| An estimate | § 5: the quantity, the number, how it was reached (one line), and the NFR it sizes |
| A failure mode | § 11: what fails · what the person sees · what Invana does · the criterion or NFR that proves it |
| An evaluation | § 14: each NFR → the design that meets it → verdict *meets · at risk · gap* → for a gap, the `recommend` row ID |

## 4. Check

`python3 scripts/specs/check.py` — it checks that every NFR ID is unique and well-formed, every `nfrs:` entry exists,
every feature has `## System impact` and `## Engine`, and every link resolves. A failing check is not done.

## 5. Review

The spec review (`.claude/team/TEAM.md` §5) shows the System impact with the spec: the NFRs touched, the HLD sections
changed and their § 14 rows. A new NFR or a changed target is Ravi's call. A change to a store, a service or the
deployment shape is a breaking change (`product-spec` §3) — asked, never assumed.

## 6. When the build disagrees

The coder builds to the HLD and the feature's `## Engine`. A build that must deviate stops and raises a `raise` row to
the product manager; the design changes first, then the code. QA fails a change that contradicts either. Security
threat-models from § 12 and the trust boundaries in § 7.

## Not this skill

| Want | Use |
|---|---|
| A story, a criterion, a journey | `product-spec` |
| Code that implements the design | `build-feature` |
| A threat model or audit | `security-audit` |
