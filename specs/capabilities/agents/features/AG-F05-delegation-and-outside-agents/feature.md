---
id: AG-F05
title: Delegation and outside agents
product: AG
status: idea
personas: [builder, admin, analyst]
stories: [AG-24, AG-33, AG-34]
journeys: [J03]
boards: [agents.run, agents.agent, settings.ai, inbox]
nfrs: [NFR-PERF-2, NFR-COST-1]
depends_on: [AG-F01, AG-F03]
---

# Delegation and outside agents

> An agent hands part of its work to another agent — a helper it makes for the work, an agent the graph already has,
> or an agent outside Invana — always inside bounds it cannot argue with, every hand-off drawn on the run with who made
> whom, on whose behalf, and what came back. The decisions it helps make: *may this agent hand this work on, to whom,
> and is what came back fit to use?*

## User journey

Journeys this feature is a step of: [J03 · Give an agent work and decide on the result](../../../../journeys/J03-give-an-agent-work-and-decide-on-the-result.md)

```mermaid
flowchart TD
  run([An agent mid-run]) --> kind{"Hands work to"}
  kind -->|a helper it makes| bound{"Within depth · helpers per agent · helpers in all · tokens left?"}
  bound -->|no| ref["AG-24 · Refused before it starts, naming the bound and the count"]
  bound -->|too many live| q["Queued until another helper ends"]
  bound -->|yes| helper["AG-24 · A helper, given tokens from the agent's own"]
  kind -->|an agent of the graph| may{"May delegate to: Allow · Ask · Deny"}
  may -->|Deny| ref
  may -->|Ask| ask["Inbox › Needs you — routed to the agent's owner"]
  ask -->|declined| dec["The step ends declined; the agent carries on without it"]
  ask -->|approved| helper
  may -->|Allow| helper
  helper --> ret["Its answer returns, cited by the agent · unspent tokens go back"]
  ret --> tree(["AG-24 · Who did what: who made whom, on which run, on whose behalf"])
  kind -->|an outside agent| out["AG-34 · Only fields the view of the graph lets out"]
  out -->|anything else| oref["Refused before sending, naming the view · nothing leaves"]
  out --> oask{"May delegate to"}
  oask -->|Ask| oap["Inbox: what would be sent, what is held back"]
  oap -->|approved| sent["Sent from a worker · working"]
  oask -->|Allow| sent
  sent -->|asks back| qq["A question to whoever started the run"] --> sent
  sent --> back(["A verdict and what it returned — a person applies it"])
  admin([Settings › AI and connections]) --> add["AG-33 · Add an outside agent by its A2A card — added off"]
  add --> on["Turned on · who may delegate to it · its limits"]
  on --> out
```

```mermaid
sequenceDiagram
  actor P as Person who started the run
  participant A as Agent
  participant E as Engine
  participant H as Helper or outside agent
  actor O as Owner (Inbox)
  A->>E: hand this work to H
  E->>E: check bounds, may-delegate-to and what may leave
  alt Ask
    E->>O: what would be sent · what is held back
    O-->>E: Approve · Decline
  end
  E->>H: the work, with tokens set aside (helper) or a task (outside agent)
  H-->>P: a question back, when it needs one
  H-->>E: verdict and what it made
  E-->>A: the verdict, as data the agent cites
  E-->>P: How it got here shows the hand-off, its steps and sources
```

## Stories

| ID | Story | Status |
|---|---|---|
| AG-24 | [See who made whom, and hand work to a helper within bounds](stories/AG-24-see-who-made-whom-and-hand-work-to-a-helper-within-bounds/story.md) | idea |
| AG-33 | [Add an outside agent by its card](stories/AG-33-add-an-outside-agent-by-its-card/story.md) | idea |
| AG-34 | [Hand a fix to an outside agent and get its result back](stories/AG-34-hand-a-fix-to-an-outside-agent-and-get-its-result-back/story.md) | idea |

## Access

| Act | Role (`.claude/team/TEAM.md` §7) | Everyone else sees |
|---|---|---|
| Read who made whom, every hand-off and what came back on a run | Operator — anyone who can open the run | A run they cannot open reads *not found* |
| Set what an agent may hand on — may make helpers, its bounds, *May delegate to* | `builder` · shown as *Can build agents* · Admin | The settings read; editing is disabled, naming *Can build agents* |
| Approve or decline a hand-off that asks each time | The owner of the agent asked for (AC-F05) | The ask reads, naming who it waits on |
| Answer an outside agent's question back | Whoever started the run | The question reads, naming who it waits on |
| Add, turn on or off, read again or remove an outside agent | Admin, in Settings › AI and connections | Outside agents read; each act is disabled, naming the Admin |
| Apply what an outside agent returned — merge, publish | A person, outside Invana or in the record's own feature | Invana applies none of it |

## States

| State | What the person sees |
|---|---|
| First use | A run with one agent draws it alone; no outside agent added yet — what one is, and *Add an outside agent* for an Admin |
| Empty after a filter | — |
| Loading | The run's head drawn at once; who did what loads in place |
| Has data | Who made whom with each helper's state and tokens against what it was given; an outside agent's task with its state and what came back |
| Failed | A refused hand-off names the bound, the count or the view of the graph; a helper's failure is the agent's evidence, never a silent gap |
| Agent working or proposing | Helpers running or queued; an outside agent *working*; a hand-off waiting on an ask, drawn dashed |
| No access | Settings read; acts disabled, naming who may; a run they cannot open reads *not found* |

## Rules

| Rule | Detail |
|---|---|
| Handing on is a step | Making a helper, delegating and waiting for answers are steps of the plan, checked against what the agent may do before they run |
| Bounded four ways | Depth below the first agent · helpers per agent · helpers in all · helpers live at once. Past the first three it is refused before it starts, naming the bound and the count; past the fourth the helper waits *queued* |
| Tokens are set aside | Making or delegating to a helper sets tokens aside from the agent's remaining budget; unspent tokens return when it ends, and a history row says so. Asking for more than remains is refused, naming what remains |
| A helper is never wider | It works inside the view of the graph its run opened with, and within the agent's own bounds; it may only narrow them |
| Helpers end with the work | A helper is made for one piece of work and retires when it closes; its row and its runs are kept |
| A delegated agent keeps its own access | An agent of the graph asked for help works with its own access, narrowed by the root agent's own rule, inside both views of the graph, paid from the asker's tokens; the strictest value along the caller chain binds ([The strictest along the caller chain](../../../../os/access/product.md#decisions)) |
| *May delegate to* is a line | Each agent's Allow · Ask · Deny is a line like any other; the strictest of it and every rule for everyone binds |
| No loops | An agent already in the run's chain cannot be asked again; an outside agent cannot call back into the graph inside the same task |
| Every helper ends for one reason | served · cannot answer · out of tokens · out of time · out of steps · no progress · loop · stopped with its parent · stopped · failed |
| Stopping cascades | Stopping an agent's run stops every helper beneath it |
| An answer is data | What a helper or an outside agent returns is cited by the agent, never obeyed as an instruction |
| Only what may leave, leaves | An outside agent receives only fields the view of the graph lets out and the skill marks to send; anything else refuses the step before sending |
| Ask by default | A new outside agent is *Ask* for every agent until a person says otherwise |
| Invana applies nothing that came back | A pull request, a patch or a report from an outside agent is kept on the run; a person applies it |
| An outside agent's own limits | Time, attempts and tasks at once; Invana's tokens cover only its own side |
| Leans on | Build an agent (AG-F01) · runs (AG-F03) · the Inbox (GR-F05) · views of the graph (SE-F09) · workers (RT-F03) · AI and connections (RT-F01) |

## Data touched

| Record | Read or write |
|---|---|
| Helper agents — who made them, on which run, retired with the work | Write · read |
| A helper's run — tokens set aside and returned, why it ended | Write · read |
| *May delegate to* on an agent | Write · read |
| Delegation asks and their answers (AC-F05) | Write · read |
| Outside agents — card, endpoint, skills on the card, credential name, workers they call from, limits, on or off | Write · read (Admin) |
| An outside task — state, what was sent, what was held back, what came back | Write · read |
| History rows of every hand-off (AC-F06) | Write · read |

## Engine

### Records

| Table | Columns | Notes |
|---|---|---|
| `agents_remote_agents` | `name` · `card_url` · `card` (as read) · `card_read_at` · `a2a_version` · `credential_name` · `pool` (the workers it is called from) · `limits` (time, attempts, tasks at once) · `enabled` · `added_by_id` | An install's outside agent; `name` unique. The card is kept as read until an Admin reads it again |
| `agents_remote_tasks` | `run_id` · `step_id` · `remote_agent_id` · `skill` · `remote_task_id` · `state` (`submitted` · `working` · `needs_input` · `done` · `failed` · `cancelled`) · `sent` · `held_back` · `result` · `artifacts` · `started_at` · `settled_at` | One per task handed out; `result` and `artifacts` are data, never instructions |

### Reads

| Record | Owner |
|---|---|
| The `agents` row — a helper is `kind = spawned`, `lifetime = ephemeral`, with `parent_agent_id` and `spawned_in_run_id`; an outside agent is `kind = remote` with `remote_agent_id`; `budget` · `effort` · `policy.may_delegate` | [AG-F01](../AG-F01-build-an-agent/feature.md#engine) |
| Runs — `parent_run_id`, `escrow_tokens`, `escrow_returned`, `exit_reason`, the caller chain | [AG-F03](../AG-F03-runs-and-how-the-agents-are-doing/feature.md#engine) |
| Delegation asks (kind `delegation`) and their verdicts | [AC-F05](../../../../os/access/features/AC-F05-asks-and-approvals/feature.md#engine) |
| The hand-off events *who made whom* reads | [AC-F06](../../../../os/access/features/AC-F06-history/feature.md#engine) |
| The view of the graph a helper narrows and what may leave | [SE-F09 › Engine](../../../semantics/features/SE-F09-views-of-the-graph/feature.md#engine) |
| Workers a call goes out from and their credentials | [RT-F03](../../../../os/runtime/features/RT-F03-workers-and-the-queue/feature.md#engine) |
| Retiring a task's helpers when it closes | [PJ-F01](../../../projects/features/PJ-F01-projects-and-tasks/feature.md#engine) |

### Routes

| Route, after `/api/v1/u/{u}/{g}` | Does | Story |
|---|---|---|
| `GET /agents/{id}/helpers?days=7·30·90` | `{agent_id, nodes[{id, kind (agent · user · task), label, agent_kind?, status?, lifetime?}], edges[{id, source, target, kind, label, event_id?}]}` — the helpers it made in the window | AG-24 |

| Route, install-wide, after `/api/v1` | Does | Story |
|---|---|---|
| `GET /agents/remote` · `POST /agents/remote` | List (the list contract) · add one by its card | AG-33 |
| `GET /agents/remote/{name}/card` | The card as read, with `card_read_at` | AG-33 |
| `POST /agents/remote/{name}/enable` · `POST /agents/remote/{name}/disable` · `POST /agents/remote/{name}/refresh` | Turn on · off · read the card again | AG-33 |

### Events

| Event | When |
|---|---|
| `agents.spawn` | A helper's `agents` row is written |
| `agents.runs.delegate` | A step opened a helper's or a delegated agent's run |
| `agents.runs.escrow_return` | A helper's run ended and its unspent tokens went back |
| `agents.remote.delegate` · `agents.remote.input_required` · `agents.remote.return` · `agents.remote.refuse` | A task handed out · the outside agent asks back · it returned · a hand-off refused before sending |

### Refusals

| Status | When | Sentence | Criterion |
|---|---|---|---|
| step refused | `max_depth`, `max_children` or `max_descendants` reached | *This passes {bound} — {count} of {max}.* | AG-24.2 |
| step refused | Escrow asked above the parent's remaining run budget | *{remaining} tokens remain.* | AG-24.4 |
| step refused | `may_delegate` is `never` for the agent asked, or it is already in the caller chain | *{agent} is Deny for {asker}.* · *{agent} is already in this run — loop.* | AG-24.10 |
| step refused | A helper made by an agent whose `policy` does not allow helpers, or a helper's helper its parent did not name | *{agent} may not make helpers.* | AG-24.19 |
| step refused | A strictest line along the caller chain denies the act | *{agent}'s line denies {act}.* | AG-24.18 |
| step refused | An outside agent off, or not in *May delegate to* | *{outside agent} is off.* · *{outside agent} is not in May delegate to.* | AG-34.3 |
| step refused | A field the view does not let out or the skill does not mark to send | *{field} may not leave this view.* | AG-34.2 |
| step refused | A skill missing from the card as last read | *{outside agent}'s card of {date} has no {skill}.* | AG-33.5 |
| step refused | The outside agent calls back into the Graph inside the same task | *An outside agent cannot call back inside its task.* | AG-34.12 |
| 422 | A document that is not an A2A agent card, or offers no A2A version Invana speaks | *Found {version}; Invana speaks A2A {pinned}.* | AG-33.9 |
| 403 | Adding, turning on or off, reading again or removing an outside agent without Admin | *Only an Admin adds outside agents.* | AG-33.8 |

### CLI

| Command | Does |
|---|---|
| `invana agents remote add <card-url> --name` | Add an outside agent by its card |
| `invana agents remote refresh` · `enable` · `disable` · `list` | Read the card again · turn on · off · list |

### Mechanisms

| Mechanism | How |
|---|---|
| `work.spawn_agent` | A step, side effect `write`: writes a `spawned`, `ephemeral` helper narrowed to its parent; a lasting helper only through the parent's `pins`; skills named at spawn (AG-F04) |
| `work.delegate` | A step: reads `policy.may_delegate` — `always` runs; `ask` raises an access ask of kind `delegation` to the agent's owner and waits on its verdict; `never` and a loop refuse. *Allow always* writes `always` into the asker's `may_delegate` |
| `await_children` | The parent's step waits on its live helpers and outside tasks |
| `work.delegate_remote` | A step, side effect `send`: hands a task over A2A from a worker that can reach the agent, under the outside agent's limits; the parent's step waits on it as on a helper |
| Make a helper, in order | 1 · check depth, children, descendants and what the parent may do, refusing by the bound · 2 · write the helper's `agents` row, narrowed, its `soul` and `soul_traits` copied · 3 · write the child run and take `escrow_tokens` from the parent's remaining run budget · 4 · queue the child run's first step. Spawning is a record; a worker that takes the queued step runs it |
| A helper narrows key by key | Its effort and budget are its parent's, each key the smaller of the parent's and what was asked; `max_depth` one less; its view, functions and tokens are its parent's or narrower |
| Past `max_live` | The helper waits `queued` until another ends |
| `max_fanout` | Checked at validation and drawn on screen; no fanned-out step is dispatched |
| Escrow | Unspent `escrow_returned` goes back at settle with `agents.runs.escrow_return` |
| Who made whom | Edges are `parent_agent_id`, `spawned_in_run_id` and the delegation events, each edge naming its event; *on behalf of* is read from the event of each hand-off, never from the agent row |
| Helpers end with the work | A task's close retires the helpers made for it (`retire_ephemeral_for_task`) |
| An outside agent | An `agents` row with `kind = remote` and no envelope, budget or soul; its limits are `agents_remote_agents.limits`. It starts *Ask* for every agent |
| The A2A client | The optional extra `invana[a2a]`, speaking A2A 1.0 |

## System impact

| HLD section | Change | NFRs |
|---|---|---|
| § 6 Data and storage | Two tables in Invana's own store; helpers are `agents` rows | — |
| § 8 APIs and events | The routes, events and CLI above | — |
| § 9 Distributed execution | A helper is a queued child run; its tokens are escrowed from the parent's | — |
| § 10 AI and agents | Delegation is a step bounded four ways; the strictest line along the caller chain binds; what comes back is data | — |
| § 11 Failure modes and the outside boundary | Outside agents over A2A, called from workers; only what may leave is sent | — |
| § 12 Qualities | Security: an outside agent's credential stays on the workers; a hand-off may ask first | — |

## Decisions

| Decision | Detail |
|---|---|
| Who made whom is drawn | On the run's *Who did what*: the person or task, the first agent, every helper with its state, its depth and its tokens against what it was given; many helpers under one agent collapse to a count |
| The floor is drawn | Each helper reads its depth; a refusal at the floor is drawn in place, naming the bound |
| A helper's bounds read beside its parent's | View of the graph, what it may do and its tokens, bound by bound, the parent's beside the helper's |
| On behalf of | Read from the record of each hand-off, never restated by the agent |
| Retired helpers stay drawn | Marked retired, still selectable |
| Making helpers is a setting of what it may do | An agent makes helpers only when what it may do includes it; one agent that ships with Invana may — the Coordinator — and it is not the graph's default |
| *Allow always* on an ask | Writes *Allow* for that agent into the asker's *May delegate to* |
| An outside agent is added by its A2A card | The A2A agent card — at `/.well-known/agent-card.json` or the address an Admin gives — is the only way in; its name, version, skills, interfaces and how it signs in are read and kept as they were read; a change on its side reaches nothing until an Admin reads the card again. The A2A version Invana speaks is pinned in [System design § 11](../../../../system-design.md#11-failure-modes-and-the-outside-boundary) › *Standards* |
| An outside agent is an agent | Listed with the graph's agents as *outside*; it shows in Flow, Runs and History like any agent, and is never given a task |
| MCP carries tools, A2A carries tasks | An outside agent's task — over A2A — asks back, has states and returns what it made; a tool call — over MCP — is one request and one answer (RT-F02) |
| Calls go out from workers | From workers that can reach it, with its credential set on them; nothing passes through a hosted service |
| A helper lives for the work | A lasting helper only when the parent's fixed arguments allow it; a helper makes helpers only when its parent may and names it |
| An agent's helpers read over a window | Its sheet lists the helpers it made in 7, 30 or 90 days, each with its run; who made whom inside one run is the run's |
| Not built yet | Outside agents — reading a card, the tasks they take and their states — have no engine yet |

## Open questions

| Question | Who answers |
|---|---|
| Who owns an agent for routing a delegation ask, now agents are built once for the install (AG-F02) — the builder who published it, or the graph's owner? | Ravi |

## Not building

| Item | Why not |
|---|---|
| Helpers that outlive the work by default | An agent that outlives its reason accumulates silently |
| Handing work across graphs | The graph is the reasoning boundary |
| Agents chatting with each other | Delegation is a task with a verdict; an agent asks a person, never another agent |
| Editing who made whom | It is what happened |
| An org chart of agents | Who made whom is causal, not a hierarchy |
| Outside agents delegating into this graph | Later; an outside agent reaches a graph over its MCP server, under a key (RT-F02) |
| An outside agent applying its own result | A person merges or publishes |
| Chatting with an outside agent | A hand-off is a task with a verdict |
| Paying an outside agent from the token budget | Its cost is its own; Invana bounds it by time, attempts and tasks at once |
