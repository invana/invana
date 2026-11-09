---
id: RT-F03
title: Workers and the queue
product: RT
status: idea
personas: [admin, builder]
stories: [RT-05, RT-06, RT-07, RT-08, RT-09, RT-10]
journeys: []
boards: [settings.workers]
depends_on: [RT-F04, AG-F03]
---

# Workers and the queue

> The machines that run agents' work and the order work is taken in — added and scaled by an install admin, read
> everywhere. The decision it helps make: *where is work waiting, and do we add workers or let it queue?*

## User journey

```mermaid
flowchart TD
  s([Settings › Invana]) --> lim(["RT-F04 · Limits for each graph"])
  s --> wk["RT-09 · Workers: each group, its workers, what each runs"]
  wk -->|no workers| nw["Steps run inside the engine · Add workers"]
  wk --> cap["RT-08 · Where steps wait · how many workers would clear it"]
  cap -->|a group is short| add["RT-10 · Add workers: where · group · join key · run it · joined"]
  add -->|a check fails| fx["Says which check and what to look at"]
  add -->|first heartbeat| j(["Joined · takes work"])
  wk --> flow["RT-05 · Where work is: started · admitted · running · waiting — and why"]
  flow --> ord["RT-06 · The order work is taken: questions · project tasks · batch"]
  flow --> co["RT-07 · The coordinators · a lost one's runs move on"]
  flow --> adm(["RT-F04 · Admitted, waiting or refused · rate limits · held runs"])
  wk -->|without Admin| ro(["Reads · acts disabled · Install admins add and scale workers"])
```

```mermaid
sequenceDiagram
  participant W as Worker (a machine of yours)
  participant E as Engine
  actor A as Install admin
  A->>E: mint a join key for a worker group
  A->>W: run the one command
  W->>E: join with the key · its labels · its plugins
  E->>E: key valid · labels fit the group · plugins carried
  E-->>W: its own credential
  loop every 2 s
    W->>E: heartbeat
  end
  W->>E: take work its group covers
  E-->>W: one step
  W->>E: the step's result
```

## Stories

| ID | Story | Status |
|---|---|---|
| RT-05 | [See where work is and why it waits](stories/RT-05-see-where-work-is-and-why-it-waits/story.md) | idea |
| RT-06 | [Questions go before batch work](stories/RT-06-questions-go-before-batch-work/story.md) | idea |
| RT-07 | [A lost coordinator costs seconds, not runs](stories/RT-07-a-lost-coordinator-costs-seconds-not-runs/story.md) | idea |
| RT-08 | [See how many workers each group needs](stories/RT-08-see-how-many-workers-each-group-needs/story.md) | idea |
| RT-09 | [See every worker and what it is running](stories/RT-09-see-every-worker-and-what-it-is-running/story.md) | idea |
| RT-10 | [Add workers on my own machines with one command](stories/RT-10-add-workers-on-my-own-machines-with-one-command/story.md) | idea |

## Access

| Act | Role (`.claude/team/TEAM.md` §7) | Everyone else sees |
|---|---|---|
| Read Workers — groups, workers, where work waits, coordinators, rate limits | Operator — every member | — |
| Add workers · make or change a worker group · mint and revoke join keys · drain a worker | Admin | Each act disabled — *Install admins add and scale workers* |

## States

| State | What the person sees |
|---|---|
| First use | No workers: *Steps run inside the engine on this install. Add workers to run tool steps on other machines.* and *Add workers* |
| Empty after a filter | Workers filtered to a state none has: *No worker matches* |
| Loading | The section opens at once; rows fill in place |
| Has data | Each worker group with its workers, what each runs, where steps wait and how many workers would clear it |
| Failed | A join that failed, naming the check; a lost worker, with how many steps were handed on; a step no group covers, naming the missing label |
| Agent working or proposing | A run waiting names its position and what it waits behind |
| No access | Everything reads; every act is disabled — *Install admins add and scale workers* |

## Rules

| Rule | Detail |
|---|---|
| A run waiting is not a run running | It holds no slot, uses no worker and costs nothing |
| Questions go first | Work is taken in this order: a question someone waits on · a project task picked up · batch (schedules, sweeps, runs past twenty agents). Busy Graphs share the install equally; an idle Graph's share is lent |
| Waiting always says why | A waiting run names its position and what it waits behind — *a person is waiting* · *helper — counts as a run* · *schedule* — or the limit, the AI model's rate limit or the worker group |
| Agents never start machines | Workers are added and scaled by a person; Invana says where steps wait and how many workers would clear them |
| Work goes by labels | A step goes to a worker group whose labels cover what its function needs; a step no live group covers waits, naming the missing label, then fails |
| A worker dials out | Over HTTPS with its own credential; no inbound port, no database credential; it runs steps under the agent's access, never its own |
| A lost worker loses no work | No heartbeat for 30 s is lost; its steps go to another worker and run once |
| Join keys are shown once | Scoped to one worker group, with an expiry and a cap on how many may join; revoking stops new joins; draining stops a worker after what it holds |
| A library runs where it is installed | A library added in Agents (AG-F02) must be installed on the workers of the groups that run its functions; Workers shows which groups carry it |
| The engine counts | Every number on Workers and Usage — busy, waiting, oldest, suggested — is stored by the engine; Studio only shows it |
| Leans on | Limits (RT-F04) · runs (AG-F03) · plugins and outside tools (RT-F02) |

## Data touched

| Record | Read or write |
|---|---|
| Worker groups — name, runs on, labels, slots a worker, plugins, secret names, outbound domains | Read · write |
| Workers — state, what each runs, heartbeat | Read · write (drain) |
| Join keys | Write · read |
| Stored counts every 30 s — workers, busy, waiting, oldest, suggested | Read |
| Waiting and refused runs with their reasons (AG-F03) | Read |
| History rows of every limit, join, drain and revoke (AC-F06) | Write |

## Decisions

| Decision | Detail |
|---|---|
| Workers is Settings › Invana | One section with Workers · Where work waits · Join keys; a worker group or a worker opens in place, with a breadcrumb; Add workers is a modal |
| Worker groups are the install's | An Admin assigns each Graph the groups it may use; a heavy Graph gets its own, others share |
| Suggested is the engine's | Steps ready ÷ steps a worker took over the last ten minutes, every 30 s |
| Every group is scaled by hand | Docker, Python or Kubernetes; Invana never starts a machine and holds no cloud keys |

## Open questions

| Question | Who answers |
|---|---|
| RT-05 · RT-06 · RT-07 · RT-12 · RT-13 come from a scale-out proposal still under review (durable runs, coordinators, admission, the AI-model rate limiter). Recommend: keep them at `idea` until Ravi accepts the proposal; the rest of the feature stands without them | Ravi |
| Where does *Where work is* (RT-05) draw — a tab of Workers, or each run in Inbox › Running? Recommend: a tab of Workers for the install; a run's own wait on its run | Ravi |

## Not building

| Item | Why not |
|---|---|
| Autoscaling, cloud APIs, a Helm chart | A person adds workers; Invana says how many |
| Agents asking for workers or starting machines | A person adds and scales workers |
| Pinning an agent or a run to a worker | Work goes per step, by labels |
| Priority weights per agent · stopping a running run to make room | A weight nobody can explain makes an order nobody can predict; a half-run agent leaves work nobody can account for |
| One-shot containers, a Claude Code runtime | Claude Code reaches a Graph over its MCP server (RT-03) |
| Access rules on workers | Workers run any agent's steps; access belongs to the agent |
| Keeping workers near a cache | An optimisation for later |
