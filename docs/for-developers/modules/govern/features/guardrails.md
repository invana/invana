# Guardrails

The bounds every run in the Graph carries, whatever world it runs in — which participants, which
properties, which slices, and what may leave. Set once by whoever is accountable; invisible
afterwards.

| | |
|---|---|
| Index | [14.2](../../../README.md#14--govern) · Slice **S16** |
| Module | [Govern](../spec.md) |
| API / CLI / Studio | 🔵 / — / 🔵 |
| Related | [worlds](worlds.md) (what narrows within these) · [audit-and-activity](../../operate/features/audit-and-activity.md) (a guardrail edit is an audited write) |

> **As** someone accountable for what this Graph may do with its data, **I want** one place that says
> what no run may see or send, **so that** I can hand it to an auditor and know nobody's experiment
> loosened it.

## Capabilities

| # | Capability | Notes |
|---|---|---|
| G1 | One surface, one object | The **Guardrails** drawer of the Govern panel. Never in the Worlds list |
| G2 | Pinned on the Graph or an agent | Bounds nest; an agent's narrows the Graph's |
| G3 | The same grammar as a world | Participants, properties, selectors, egress — set once, always in force |
| G4 | Egress per destination | *entity names to the enrichment API; the question and the schema shape to a hosted model; nothing to anything else* |
| G5 | Edit is a permission, not a role | Members stay binary; this is the one field-level permission in the product |
| G6 | Every edit is an event | Who loosened what, when, and what it was before |
| G7 | A refusal names the rule | Never *not permitted* with nothing to act on |

---

## Journey 1 — set a guardrail

```mermaid
sequenceDiagram
    autonumber
    actor Ad as Someone accountable
    participant S as Govern › Guardrails
    participant E as Engine
    participant W as Existing worlds

    Ad->>S: ?panel=govern&drawer=guardrails
    S-->>Ad: the rules in force, Graph-wide
    Ad->>S: add "third_party/** deny"
    Ad->>S: add "Deal.revenue excluded"
    Ad->>S: egress — llm/** may send type_names, the_question
    S->>E: PATCH lens · kind = guardrail · scope = graph
    E->>W: revalidate every world against the new bound
    alt a world no longer fits
        E-->>S: names the worlds and what each one loses
        Ad->>S: confirm — the worlds are narrowed, not deleted
    else all fit
        E-->>S: saved
    end
    E->>E: emit lens.updated with the before and after
    Note over E: in-flight runs keep the lens they froze.<br/>Nothing is rewritten retroactively.
```

**The revalidation is the point of the confirm step.** A guardrail that silently invalidates six
worlds is a guardrail whose effect nobody saw at the moment they took responsibility for it.

---

## Journey 2 — a run meets a guardrail, three different ways

```mermaid
sequenceDiagram
    autonumber
    participant I as Interpreter
    participant C as Connector
    participant X as A participant
    actor P as Person

    Note over I: graph data — outside the lens
    I->>I: the plan wants graph_data/stitch/publisher_sponsor
    I->>I: refused by rule · record touch dir=refused
    I->>I: the run continues without the link
    I-->>P: cannot answer — needs the Publisher link,<br/>excluded by a guardrail
    P-->>P: recourse: ask whoever owns the guardrail

    Note over I: third party — refused before dispatch
    I->>I: the plan wants third_party/api/clearbit.com
    I->>I: refused before the call · nothing spent, nothing left
    I->>I: the run continues without it

    Note over I: egress — the call is allowed, the payload is not
    I->>I: llm/anthropic-prod allowed
    I->>I: prompt would carry property_values; may_send says no
    I->>C: rebuild the prompt without them
    C->>X: call
    X-->>C: completion
    I->>I: record touch · sent.classes = [type_names, the_question]
```

| Where it bites | What happens | What the person is told |
|---|---|---|
| `graph data` | the link does not resolve; the run continues | *cannot answer — needs X, excluded by a guardrail* |
| `third party` | refused **before dispatch** — nothing spent, nothing left | *this run may not call X* |
| `egress` | the call proceeds, the payload is cut to what is permitted | recorded on the touch; surfaced on the step's Egress band |

**Three behaviours, one vocabulary.** All three say *the answer needs something you are not allowed
to use here*; only the recourse differs, and the refusal carries it.

---

## Journey 3 — an auditor asks what a run was allowed to see

```mermaid
sequenceDiagram
    autonumber
    actor Au as Auditor
    participant S as Govern › Guardrails
    participant R as Run dashboard
    participant E as Engine

    Au->>S: what may this Graph do with its data?
    S-->>Au: one object, one owner, one list of rules
    Au->>S: has it changed?
    S->>E: GET events · lens.*
    E-->>Au: every edit, who, when, before and after
    Au->>R: and this particular run?
    R->>E: GET …/runs/{id}/trace
    E-->>R: lens_snapshot — the rules as frozen that day
    R-->>Au: This run's lens — allowed · touched · refused
    Au->>R: did anything leave?
    R-->>Au: Egress band — what crossed, to which system, in which classes
    Note over Au,R: lens_snapshot is one document.<br/>No composition to compute.
```

---

## Seams

| Seam | What the user sees |
|---|---|
| A guardrail is loosened | An event with before and after; past runs are untouched, because each froze its own |
| A guardrail is tightened mid-flight | In-flight runs keep the lens they froze; the next run gets the new one |
| An agent guardrail tries to widen the Graph's | Refused at save, naming the Graph's rule |
| No guardrails set | The tab shows the widest state as a sentence, not an empty list — *every configured provider, every third party your agents can reach, the whole global model* |
| Someone without the permission opens the tab | Read-only, with the rules visible. A bound nobody may read is a bound nobody can work within |
| The last person with the permission leaves | The Graph's owner holds it; it cannot become unassigned |

---

## Surfaces

| Surface | Shape |
|---|---|
| Govern › `Guardrails` | Second drawer of the stack. Rules grouped by layer; each with its match, its rule, its selector and its egress |
| The widest state | A sentence when nothing is set, never an empty table ([SR34](../../operate/features/see-what-ran.md)'s rule, applied to configuration) |
| Agent panel | That agent's own guardrail — replacing the provider field that D2 removed |
| Worlds drawer | The sibling above it. Its header names how many rules are in force |
| A refusal | Wherever the run surfaces, naming the rule and the recourse |

---

## Engine

| Thing | Shape |
|---|---|
| `lenses` | `kind = guardrail` · `scope = graph \| agent:<id>` · never listed by `?kind=world` |
| Permission | One field-level permission on the Graph, held by at least one member. Not a role |
| Revalidation | On save, every `kind = world` in the Graph is checked; the response names what each one loses |
| Composition | `effective = agent ∩ plan ∩ todo` — guardrails enter as the agent's and the Graph's contribution |
| Events | `lens.created · updated · promoted · deleted`, with before and after on the payload |
| Routes | `GET · PATCH …/lenses?kind=guardrail` · `GET …/lenses/guardrail/impact` (what a proposed change would cost) |

---

## Decisions

| # | Decision |
|---|---|
| GR1 | **A guardrail never appears in the Worlds list.** Its own route, its own permission, its own tab — so there is no delete control to block and one object to hand an auditor ([GV16](../spec.md)). |
| GR2 | **Saving a guardrail revalidates every world and says what each one loses**, before it is saved. A bound whose effect is invisible at the moment someone takes responsibility for it is a bound taken on trust. |
| GR3 | **In-flight runs keep the lens they froze.** A guardrail is not applied retroactively, because `lens_snapshot` is what makes a past answer reconstructible ([SR11](../../operate/features/see-what-ran.md)). |
| GR4 | **A refusal names the rule and the recourse.** *Not permitted* with no rule named is not a decision anyone can act on — the same argument [§0.10](../../../orchestration.md#010-budget--the-ceiling-that-pauses-instead-of-failing) makes for a budget prompt naming its number. |
| GR5 | **The tab is readable by everyone and editable by a permission.** A bound nobody may read is a bound nobody can work within, and it turns every refusal into a mystery. |
| GR6 | **The widest state is a sentence, not an empty table.** *Nothing set* and *nothing permitted* must never look alike. |
| GR7 | **Editing a guardrail is an ordinary audited write**, in `core/events` like every other. There is no separate governance log to keep in step with the real one. |

---

## Not building

| Not building | Because |
|---|---|
| Roles on people | Members are binary ([terminology § 2](../../../terminology.md)); this is one field-level permission, not the start of a role system |
| Approval workflow for a guardrail change | the event is the record, and a Graph that needs four-eyes on this needs it on more than this |
| Guardrails that expire | a bound with a timer is a bound nobody is watching. A time-boxed exception is an agent-scoped guardrail someone removes |
| Retroactive application to past runs | `lens_snapshot` is what makes an answer reconstructible (GR3) |
| A separate governance audit log | every edit is already an event (GR7) |
| Templates or presets of guardrails | a starting set that fits nobody is a set everyone edits blindly |
