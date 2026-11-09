---
id: RT-F04
title: Limits
product: RT
status: idea
personas: [admin, builder]
stories: [RT-11, RT-12, RT-13, RT-14]
journeys: []
boards: [settings.usage, settings.workers, agents.run]
depends_on: [RT-F03, GR-F04, AC-F05, AG-F03]
---

# Limits

> What each Graph may spend and how many runs it may have going — set once by an install admin, read everywhere — and
> why a run started, waits or was refused. The decision it helps make: *do we raise a Graph's limit, or let it queue?*

## User journey

```mermaid
flowchart TD
  s([Settings › Invana]) --> lim["RT-11 · Limits for each graph: tokens a month · runs at once · worker group · queue or refuse"]
  start([A run starts]) --> adm["RT-12 · Each start admitted, waiting or refused · the rule that decided"]
  adm -->|admitted| go(["Runs · RT-F03"])
  adm -->|at the limit · queue| w["Waits, with its position and why"]
  adm -->|at the limit · refuse| no(["Skipped, with the reason"])
  go --> ai["RT-13 · Each AI model's rate limit · what waits on it · each Graph's part"]
  ai -->|the wait runs out| f(["Failed, naming the model"])
  w --> held["RT-14 · Held: which limit · how full · what is ahead"]
  held -->|Ask for more| ask(["An ask in Needs you (AC-15)"])
  s -->|without Admin| ro(["Limits for each graph is absent"])
```

## Stories

| ID | Story | Status |
|---|---|---|
| RT-11 | [Set each graph's tokens, runs at once and workers](stories/RT-11-set-each-graphs-tokens-runs-at-once-and-workers/story.md) | idea |
| RT-12 | [See why a run started, waits or was refused](stories/RT-12-see-why-a-run-started-waits-or-was-refused/story.md) | idea |
| RT-13 | [See each AI model's rate limit and what waits on it](stories/RT-13-see-each-ai-models-rate-limit-and-what-waits-on-it/story.md) | idea |
| RT-14 | [Know why my run is held and ask for more](stories/RT-14-know-why-my-run-is-held-and-ask-for-more/story.md) | idea |

## Access

| Act | Role (`.claude/team/TEAM.md` §7) | Everyone else sees |
|---|---|---|
| Read this Graph's limits | Operator — every member (GR-14) | — |
| Set each Graph's tokens a month, runs at once, worker group and *queue or refuse* | Admin | *Limits for each graph* is absent |
| Ask for a higher limit from a held run | The person who started the run | — |
| Allow that ask | Admin, in Needs you (AC-15) | As AC-F05 |

## States

| State | What the person sees |
|---|---|
| First use | Every Graph on the default limits |
| Empty after a filter | — no filter on this surface |
| Loading | The section opens at once; rows fill in place |
| Has data | Each Graph's limits; each start admitted, waiting or refused with the rule that decided; each AI model's rate limit and what waits on it |
| Failed | A run refused at the limit, naming the limit; a rate-limit wait that ran out, naming the model |
| Agent working or proposing | A run held by a limit says which, how full, and what is ahead, with *Ask for more* |
| No access | Everything reads but *Limits for each graph*, which only an Admin sees |

## Rules

| Rule | Detail |
|---|---|
| Limits are set once, read everywhere | An Admin sets each Graph's tokens a month, runs at once, worker group and *queue or refuse*; the Graph reads them in Usage and limits and never changes them |
| At the limit, the Graph's policy decides | *Queue* — the run waits, with its position and why; *refuse* — the firing is recorded as skipped, with the reason. The default is four at once, queue |
| An agent at its own limit is refused, not queued | And told about its own limit before the Graph's |
| Tokens are held before a call | The engine sets aside a call's most tokens before it runs and returns what it did not spend, so calls at once never pass a limit; Allow never passes one ([Allow never passes a limit](../../../access/product.md#decisions)) |
| Helpers never make room | A helper an agent makes draws on the same runs at once as its parent |
| A rate limit is a wait, not a failure | Backed off and shown as waiting; a failure only when the wait runs out, naming the model |
| Leans on | Workers and the queue (RT-F03) · this Graph's usage (GR-F04) · asks (AC-F05) · runs (AG-F03) |

## Data touched

| Record | Read or write |
|---|---|
| Each Graph's limits — tokens a month, runs at once, policy, worker groups | Read · write |
| Waiting and refused runs with their reasons (AG-F03) | Read |

## Decisions

| Decision | Detail |
|---|---|
| Limits for each graph sit with Usage | An Admin reads them under *Usage and limits*; nobody else sees the table |

## Open questions

| Question | Who answers |
|---|---|
| RT-05 · RT-06 · RT-07 · RT-12 · RT-13 come from a scale-out proposal still under review (durable runs, coordinators, admission, the AI-model rate limiter). Recommend: keep them at `idea` until Ravi accepts the proposal; the rest of the feature stands without them | Ravi |

## Not building

| Item | Why not |
|---|---|
| A Graph raising its own limits | The install controls cost and capacity |
| Budgets or runs at once set per agent by a Graph | Spend is per Graph; a Graph shapes its agents through access |
| A limit per project | The Graph owns the database connection |
