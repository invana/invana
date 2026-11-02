# Agents — module spec

| | |
|---|---|
| Index | [§5 · Agents](../../README.md#5--agents) |
| Features | [providers-and-models](features/providers-and-models.md) · [author-an-agent](features/author-an-agent.md) · [envelope-and-budget](features/envelope-and-budget.md) · [delegation](features/delegation.md) · [lifecycle](features/lifecycle.md) · [lineage](features/lineage.md) · [concurrency-and-contention](features/concurrency-and-contention.md) · [soul](features/soul.md) · [pinned-model-versions](features/pinned-model-versions.md) |
| Depends on | [Skills](../skills/spec.md) (what it may be offered) · [Workflows](../workflows/spec.md) (what it may run) · Ask (an agent runs a run) |
| Depended on by | [Work](../work/spec.md) (an agent is an assignee) · Ask (a session asks through an agent) |

Product spec: [Agents](../../../../specs/products/agents/product.md) — its features AG-F01 to AG-F07, the flows, the cross-feature decisions and what it does not build live there.

System design: [agents.md](../../../../specs/system-design/modules/agents.md) — where the agent sits, what it owns and how it is composed. This file keeps the vocabulary and the retired surfaces.

## 1. Vocabulary

Product-wide words: [terminology.md](../../terminology.md). What this module adds:

| Noun | Is | Is not |
|---|---|---|
| **Agent** | a principal that can be assigned work, carrying bindings and standing limits, thinking with effort and a stance, and speaking with a soul | a prompt · a world |
| **Soul** | who an agent is and how it speaks — Markdown on the agent, read only by the steps whose words a person reads ([5.8](features/soul.md)) | a permission · a stance |
| **Voice dials** | the soul in structured form — `humour` · `formality` · `emoji` · `greeting`, picked rather than written ([AG16](features/author-an-agent.md#decisions)) | a persona · a length setting |
| **Callable** | one catalogue entry an agent's envelope allows it to run — `run_query` · `search_web` · `fetch_source` ([AG14](features/author-an-agent.md#decisions)) | a *capability* — that word names a feature file's section |
| **Provider** | a configured LLM endpoint on the Graph — a **participant**, addressed `llm/<name>/*`, holding the models it offers | the model name, and not something an agent binds |
| **Standing limits** | what an agent may ever do, whoever asks — envelope, effort, budget, reach, its own guardrail | the world a run works in, which comes with the work |
| **Cast** | the lens's map from a plan's **role** to a model address. It is what names the model a run uses | a field on the agent |
| **Envelope** | the static bounds: which callables, which pinned arguments, which ceilings | a runtime check |
| **Effort** | how hard an agent tries before it stops — steps, replans, clarifications. Enforced like a ceiling ([EB9](features/envelope-and-budget.md#decisions)) | character · budget |
| **Budget** | the cost ceiling a run may spend. **At the ceiling a run pauses and asks** — it does not fail ([orchestration § 0.10](../../orchestration.md#010-budget--the-ceiling-that-pauses-instead-of-failing)) | a quota · a hard stop |
| **Lifetime** | `persistent` or `ephemeral` — whether the agent outlives the work it was spawned for | status |
| **Lineage** | who authored whom, who spawned whom, on what run | an org chart |

## 5. Surfaces

**There is no Agents product in a Graph** ([5.16](features/install-wide-agents-and-skills.md) WD18). The
surfaces below are spread over the platform's **Agent Builder** (Home → Overview, Fleet dashboard →
Overview, Agents, Skills, Functions, Performance), **Fleet** (workers and pools) and **Settings** (LLMs,
Connections, the ceiling → Graph limits), and over a Graph's **Graph settings › Members** (the agent in this
Graph) and **Activity** (runs, approvals, ledger). Each keeps the shape of [the Agents shell](features/the-agents-shell.md):
a rail and a workbook, no leftSection; a record's page opens as a tab beside its section.

| Surface | Region | Shape |
|---|---|---|
| Home | the workbook with nothing open | the composer, the person's recent asks, a tile per section |
| Fleet | a page — Overview · Map · Table | the dashboard ([5.10](features/fleet-performance.md)); agents → skills → namespaces; every agent's numbers |
| Agents | a page | one table on the list contract; a row opens the agent's page |
| Agent page | a tab | its tabs ([AG23](features/author-an-agent.md#decisions)) |
| Skills · Functions · Connections | pages | tables; Functions holds plans, templates and plugins as tabs |
| LLMs | a page | endpoints and every model version with who pins it; an endpoint opens in a modal |
| Lineage | a canvas tab, from an agent's page | who authored whom, who spawned whom, on what run |
| Settings | a page | the runs-at-once ceiling · running · queued with reasons · the pools |

## 5a. The drawn states

Hi-fi, at 1440×900, on the **Agents › Soul — 5.8** page of *The Assistant Speaks* canvas — `https://claude.ai/artifact/HdXWfPfwoES9CKTCpQtH5J`.

| Artboard | Feature | Shows |
|---|---|---|
| `agents.agents.detail.soul` | [soul](features/soul.md) | the Soul tab on the agent's page: a Markdown editor, the character cost in every ask, Discard · Preview · Save soul |
| `agents.agents.detail.soul.default` | [soul](features/soul.md) | no soul yet: *Speaking in Invana's default voice*, the default voice as placeholder |
| `agents.agents.detail.soul.preview` | [soul](features/soul.md) | the draft beside one sample ask answered twice — in the current voice and in the draft |
| `agents.agents.detail.soul.read_only` | [soul](features/soul.md) | the soul rendered, no editor, and why: editing needs edit rights on the agent |
