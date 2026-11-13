---
id: AG-F05
title: Delegation and outside agents
product: AG
status: idea
personas: [builder, admin, analyst]
stories: [AG-24, AG-33, AG-34]
journeys: [J03, J09]
boards: [agents.run, agents.agent, agents.external, inbox]
nfrs: [NFR-PERF-2, NFR-COST-1]
depends_on: [AG-F01, AC-F02, AC-F04, AC-F05, AC-F09, CP-F02, CP-F04, CP-F10]
---

# Delegation and outside agents

> An agent hands part of its work to another agent — a helper it makes for the work, another agent of the deployment,
> or an agent outside Invana over A2A or MCP. Handing on is a Run on `agent/<name>`: the agent that takes the work runs
> with its own Access Policies ∩ every caller's ∩ the rules for the person's teams, narrowing at every hop, within the
> caller's depth and helpers. Every hand-off is drawn on the run with who made whom, on whose behalf and what came
> back. The decisions it helps make: *may this agent hand this work on, to whom, and is what came back fit to use?*

## User journey

Journeys this feature is a step of: [J03 · Give an agent work and decide on the result](../../../../journeys/J03-give-an-agent-work-and-decide-on-the-result.md) · [J09 · Audit what an agent touched and what left the platform](../../../../journeys/J09-audit-what-an-agent-touched-and-what-left-the-platform.md)

```mermaid
flowchart TD
  run([An agent mid-run]) --> kind{"Hands work to"}
  kind -->|a helper it makes| bound{"Within depth · helpers · tokens a run?"}
  bound -->|no| ref["AG-24 · Refused before it starts, naming the limit and the count"]
  bound -->|at runs at once| q["Queued until a slot frees"]
  bound -->|yes| need{"Making a helper: Run agent/* — Allow · Ask · Deny"}
  kind -->|an agent of the deployment| may{"Run agent/name on the caller's policies: Allow · Ask · Deny"}
  need -->|Deny or no rule| ref
  may -->|Deny or no rule| ref
  may -->|already in the run's chain| loop["Refused — loop"]
  need -->|Ask| ask["Needs you — the caller's named approvers"]
  may -->|Ask| ask
  ask -->|declined or expired| dec["The step ends declined; the agent carries on without it"]
  ask -->|approved| helper
  need -->|Allow| helper["AG-24 · It runs — its policies ∩ every caller's ∩ the person's teams, tokens set aside"]
  may -->|Allow| helper
  helper --> ret["Its answer returns, cited by the agent · unspent tokens go back"]
  ret --> tree(["AG-24 · Who did what: who made whom, on which run, on whose behalf"])
  kind -->|an outside agent| on{"On, and Run agent/name allowed?"}
  on -->|off, or Deny| oref["AG-34 · Refused, naming the switch or the rule"]
  on --> out{"AG-34 · Only what the skill marks to send, no sensitive property?"}
  out -->|no| oref2["Refused before sending, naming the field — nothing leaves"]
  out --> oask["Ask unless a rule names it — what would be sent, what is held back"]
  oask -->|approved| sent["Sent from a worker · working · a ledger row"]
  sent -->|asks back| qq["A question to the person behind the run"] --> sent
  sent --> back(["A verdict and what it returned — a person applies it"])
  admin([Agents › Outside agents]) --> add["AG-33 · Add an outside agent — an A2A card or an outside MCP server — added off"]
  add --> son["Turned on · its owners · its credential · its limits"]
  son --> on
```

```mermaid
sequenceDiagram
  actor P as Person behind the run
  participant A as Agent (caller)
  participant E as Engine
  participant H as Helper, agent or outside agent (callee)
  actor N as Caller's named approvers
  A->>E: hand this work to H
  E->>E: Run agent/H on the caller's policies · depth and helpers · what may leave
  alt Ask
    E->>N: who asks, for whom, what would be sent and held back
    N-->>E: Approve · Decline
  end
  E->>H: the work — callee ∩ caller ∩ the person's teams, tokens set aside
  H-->>P: a question back, when it needs one
  H-->>E: verdict and what it made
  E-->>A: the verdict, as data the agent cites
  E-->>P: How it got here shows the hand-off, its steps and sources
```

## Stories

| ID | Story | Status |
|---|---|---|
| AG-24 | [See who made whom, and hand work to a helper within bounds](stories/AG-24-see-who-made-whom-and-hand-work-to-a-helper-within-bounds/story.md) | idea |
| AG-33 | [Add an outside agent by its card or its MCP server](stories/AG-33-add-an-outside-agent-by-its-card/story.md) | idea |
| AG-34 | [Hand a fix to an outside agent and get its result back](stories/AG-34-hand-a-fix-to-an-outside-agent-and-get-its-result-back/story.md) | idea |

## Access

Delegation and outside agents are *Reads* for Operator and *Acts* for Modeller and Admin in [the role table](../../../../os/access/features/AC-F02-access-policies/feature.md#the-role-table).
Who an agent may hand work to is a rule on its Access Policies, which only an Admin changes.

| Act | Role | Everyone else sees |
|---|---|---|
| Read who made whom, every hand-off and what came back on a run | Who may read the run's content — the person behind it, its agent's owners, Admins; others see that it ran ([AC-F04](../../../../os/access/features/AC-F04-what-an-agent-may-touch/feature.md#rules)) | Each hand-off reads *ran*, its state and its cost, never its content |
| Allow, Ask or Deny an agent handing work to another — a rule on Run `agent/<name>` | Admin, on an Access Policy ([AC-F02](../../../../os/access/features/AC-F02-access-policies/feature.md)) | The rules read on the agent's Access; changing them reads *Ask an Admin* |
| Approve or decline a hand-off that asks | The caller's named approvers, else its owners, never the person it benefits ([AC-F05](../../../../os/access/features/AC-F05-asks-and-approvals/feature.md)) | The ask reads, naming who it waits on |
| Answer a helper's or an outside agent's question back | The person behind the run | The question reads, naming who it waits on |
| Add an outside agent, turn it on or off, read its card again, set its credential and limits, remove it | Admin, in a session, with the password again for a credential | Outside agents read; each act disabled — *Needs the Admin role* |
| Name an outside agent's approvers, add a co-owner | Its owners · Admin ([AC-F05](../../../../os/access/features/AC-F05-asks-and-approvals/feature.md) · [AC-F07](../../../../os/access/features/AC-F07-ownership/feature.md)) | The approvers and owners read |
| Apply what an outside agent returned — merge, publish | A person, outside Invana or in the record's own feature | Invana applies none of it |

## States

| State | What the person sees |
|---|---|
| First use | A run with one agent draws it alone; Outside agents reads what one is, with *Add an outside agent* for an Admin |
| Empty after a filter | *No outside agents match* — the filters named, with *Clear filters* |
| Loading | The run's head drawn at once; who did what loads in place |
| Has data | Who made whom with each helper's state and tokens against what it was given; an outside agent's task with its state, what was sent and held back, and what came back |
| Failed | A refused hand-off names the rule, the limit and the count, the switch or the field; a helper's failure is the agent's evidence, never a silent gap |
| Agent working or proposing | Helpers running or queued; an outside agent *working*; a hand-off waiting on an ask, drawn dashed |
| No access | A run whose content the person may not read shows each hand-off as *ran* with its state and cost; outside agents read, every act disabled |

## Rules

| Rule | Detail |
|---|---|
| Handing on is a Run on `agent/<name>` | Delegating to an agent of the deployment or an outside agent is a step that runs `agent/<name>`; the caller's Access Policies Allow, Ask or Deny it like any resource; no rule, no hand-off ([AC-F02](../../../../os/access/features/AC-F02-access-policies/feature.md#rules)) |
| Making a helper needs Run `agent/*` | The function that makes a helper declares the need Run `agent/*` ([declared needs](../../../../os/access/features/AC-F04-what-an-agent-may-touch/feature.md#rules)); the Coordinator's built-in policy allows it, the Assistant's asks first |
| Narrowed at every hop | The callee runs with its own Access Policies ∩ every caller's on the chain ∩ the rules for the person's teams; a step any of them denies is refused, naming the agent in the chain whose rule denied it ([AC-F04](../../../../os/access/features/AC-F04-what-an-agent-may-touch/feature.md#rules)) |
| A helper holds its parent's policies | A helper is attached to its parent's Access Policies and may only narrow them; it holds no grant and is owned by the person behind the run |
| Within the caller's limits | Depth below the first agent and helpers in all are the caller's limits ([CP-F04](../../../../os/control/features/CP-F04-limits/feature.md#rules)); past either the hand-off is refused before it starts, naming the limit and the count. A helper's run takes a slot like any run; at runs at once it waits *queued* |
| Tokens are set aside | Handing on sets tokens aside from the caller's remaining tokens a run; unspent tokens return when it ends, and a History row says so. Asking for more than remains is refused, naming what remains |
| The person behind stays the person | Every run on the chain is behind the same person: their grants, their teams and their own switches bind each hop |
| Helpers end with the work | A helper is made for one piece of work and retires when it closes; its row and its runs are kept |
| No loops | An agent already in the run's chain cannot be asked again; an outside agent cannot call back into the deployment inside the same task |
| Every helper ends for one reason | served · cannot answer · out of tokens · out of time · out of steps · no progress · loop · stopped with its parent · stopped · failed |
| Stopping cascades | Stopping an agent's run stops every helper and delegated run beneath it |
| An answer is data | What a helper or an outside agent returns is cited by the agent, never obeyed as an instruction |
| An outside agent is an agent of kind *external* | Reached over A2A — by its agent card — or over MCP — through an outside MCP server ([CP-F02](../../../../os/control/features/CP-F02-plugins-and-outside-tools/feature.md)). It is the resource `agent/<name>`, owned by the Admin who added it, granted to nobody and never given a task by a person |
| Added off | A new outside agent is off until an Admin turns it on; a hand-off to one that is off is refused, naming who switched it off |
| Ask by default | A Run on an outside agent waits for the caller's named approvers unless a rule names that outside agent and allows it; a rule on `agent/*` asks at most |
| Only what may leave, leaves | An outside agent receives only what the skill marks to send, within what the caller may read; a sensitive property is never sent — the step is refused, naming it ([AC-F09](../../../../os/access/features/AC-F09-what-left-the-platform/feature.md#rules)) |
| Every hand-off out is in the ledger | Each task sent is an outbound row of *What left the platform*, schema-only or data-bearing, with the kinds, fields and record IDs sent ([AC-F09](../../../../os/access/features/AC-F09-what-left-the-platform/feature.md)) |
| One credential choice per outside agent | A shared secret, sealed, or each person's own account (per-user OAuth), chosen by an Admin as for an outside MCP server ([CP-F02](../../../../os/control/features/CP-F02-plugins-and-outside-tools/feature.md#rules)); never an environment variable |
| Invana applies nothing that came back | A pull request, a patch or a report from an outside agent is kept on the run; a person applies it |
| An outside agent's own limits | Time, attempts and tasks at once; Invana's tokens cover only its own side |
| Leans on | Build an agent (AG-F01) · runs (CP-F10) · the Inbox (CP-F08) · Access Policies (AC-F02) · what an agent may touch (AC-F04) · asks and named approvers (AC-F05) · what left the platform (AC-F09) · limits (CP-F04) · plugins, outside servers and credentials (CP-F02) · workers (CP-F03) |

## Data touched

| Record | Read or write |
|---|---|
| Helper agents — who made them, on which run, retired with the work | Write · read |
| A helper's or delegated run — tokens set aside and returned, why it ended, its caller chain | Write · read |
| Delegation asks and their answers (AC-F05) | Write · read |
| Outside agents — protocol, card or MCP server, skills on the card, credential choice, workers they call from, limits, on or off | Write · read (Admin) |
| An outside task — state, what was sent, what was held back, what came back | Write · read |
| Ledger rows of every task sent (AC-F09) · History rows of every hand-off (AC-F06) | Write · read |

## Engine

### Records

| Table | Columns | Notes |
|---|---|---|
| `agents_external_agents` | `agent_id` (its `agents` row, `kind = external`) · `protocol` (`a2a` · `mcp`) · `card_url?` · `card?` (as read) · `card_read_at?` · `a2a_version?` · `mcp_server?` (a `control_mcp_servers` name) · `credential_mode` (`shared` · `per_user`) · `secret_sealed?` · `pool` (the workers it is called from) · `limits` (time, attempts, tasks at once) · `enabled` (default `false`) · `switched_by_id?` · `switched_at?` | One per outside agent. The card is kept as read until an Admin reads it again; an `mcp` agent's skills are its server's frozen tools |
| `agents_external_tasks` | `run_id` · `step_id` · `agent_id` · `skill` · `remote_task_id?` · `state` (`submitted` · `working` · `needs_input` · `done` · `failed` · `cancelled`) · `sent` · `held_back` · `result` · `artifacts` · `ledger_call_id` · `started_at` · `settled_at` | One per task handed out; `result` and `artifacts` are data, never instructions |

### Reads

| Record | Owner |
|---|---|
| The `agents` row — a helper is `kind = helper` with `parent_agent_id` and `spawned_in_run_id`; an outside agent is `kind = external`; `effort` | [AG-F01](../AG-F01-build-an-agent/feature.md#engine) |
| Runs — `parent_run_id`, `escrow_tokens`, `escrow_returned`, `exit_reason`, the caller chain | [CP-F10](../../../../os/control/features/CP-F10-runs-and-how-the-agents-are-doing/feature.md#engine) |
| Access Policies and their attachments; the one evaluator, `decide` | [AC-F02](../../../../os/access/features/AC-F02-access-policies/feature.md#engine) |
| The caller chain and declared needs at each step | [AC-F04](../../../../os/access/features/AC-F04-what-an-agent-may-touch/feature.md#engine) |
| Delegation asks (kind `delegation`), their routing and verdicts | [AC-F05](../../../../os/access/features/AC-F05-asks-and-approvals/feature.md#engine) |
| The ledger row of each task sent | [AC-F09](../../../../os/access/features/AC-F09-what-left-the-platform/feature.md#engine) |
| Depth, helpers, runs at once and tokens a run | [CP-F04](../../../../os/control/features/CP-F04-limits/feature.md#engine) |
| Outside MCP servers, per-user accounts and switches | [CP-F02](../../../../os/control/features/CP-F02-plugins-and-outside-tools/feature.md#engine) |
| Workers a call goes out from | [CP-F03](../../../../os/control/features/CP-F03-workers-and-the-queue/feature.md#engine) |
| The hand-off events *who made whom* reads | [AC-F06](../../../../os/access/features/AC-F06-history/feature.md#engine) |
| Retiring a task's helpers when it closes | [PJ-F01](../../../projects/features/PJ-F01-projects-and-tasks/feature.md#engine) |

### Routes

| Route, after `/api/v1/agents` | Does | Story |
|---|---|---|
| `GET /agents/{name}/helpers?days=7·30·90` | `{agent, nodes[{id, kind (agent · user · task), label, agent_kind?, status?}], edges[{id, source, target, kind, label, event_id?}]}` — the helpers it made in the window | AG-24 |
| `GET /external` · `POST /external` | List (the list contract) · add one — `{name, protocol, card_url? \| mcp_server?, credential_mode, secret?, pool, limits}`; a secret needs the password again | AG-33 |
| `GET /external/{name}` · `PATCH /external/{name}` · `DELETE /external/{name}` | One, with the card as read · change its credential, workers or limits · remove one no run ever reached | AG-33 |
| `POST /external/{name}/on` · `POST /external/{name}/off` · `POST /external/{name}/refresh` | Turn on · off · read the card again | AG-33 |

### Events

| Event | When |
|---|---|
| `agents.spawn` | A helper's `agents` row is written |
| `agents.runs.delegate` | A step opened a helper's or a delegated agent's run |
| `agents.runs.escrow_return` | A helper's or delegated run ended and its unspent tokens went back |
| `agents.external.create` · `agents.external.update` · `agents.external.switch` · `agents.external.delete` | An outside agent added · changed or its card read again · turned on or off · removed |
| `agents.external.delegate` · `agents.external.input_required` · `agents.external.return` · `agents.external.refuse` | A task handed out · the outside agent asks back · it returned · a hand-off refused before sending |

### Refusals

| Status | When | Sentence | Criterion |
|---|---|---|---|
| step refused | The caller's `max_depth` or `max_helpers` reached | *This passes {limit} — {count} of {max}.* | AG-24.2 |
| step refused | Tokens asked above the caller's remaining tokens a run | *{remaining} tokens remain.* | AG-24.4 |
| step refused | No rule allows Run `agent/<name>`, or a Deny rule on the caller's policies | *{caller} may not run {agent} — {rule} on {policy}.* · *{caller} may not run {agent} — no rule allows it.* | AG-24.10 · AG-34.3 |
| step refused | The callee is already in the caller chain | *{agent} is already in this run — loop.* | AG-24.10 |
| step refused | A step denied by any agent's rules along the caller chain | *{agent}'s {rule} denies {verb} {resource}.* | AG-24.18 |
| step refused | An outside agent that is off | *{outside agent} is off — switched off by {person} {when}.* | AG-34.3 |
| step refused | A field the skill does not mark to send, or a sensitive property | *{field} may not leave.* · *{property} is sensitive — it never leaves.* | AG-34.2 |
| step refused | A skill missing from the card as last read | *{outside agent}'s card of {date} has no {skill}.* | AG-33.5 |
| step refused | A `per_user` outside agent the person behind the run has not connected | *Connect your {outside agent} account first.* | AG-34.15 |
| step refused | The outside agent calls back into the deployment inside the same task | *An outside agent cannot call back inside its task.* | AG-34.12 |
| 422 | A document that is not an A2A agent card, or offers no A2A version Invana speaks | *Found {version}; Invana speaks A2A {pinned}.* | AG-33.9 |
| 422 | An `mcp` outside agent naming an outside MCP server that does not exist | *{server} is not an outside MCP server here.* | AG-33.10 |
| 409 | Removing an outside agent a run has reached | *{outside agent} has run — turn it off instead.* | AG-33.11 |
| 403 | Adding, turning on or off, reading again, changing or removing an outside agent without the Admin role | *This needs the Admin role.* | AG-33.8 |
| 401 | Setting an outside agent's secret without the password again | *Enter your password again to do this.* | AG-33.3 |

### CLI

| Command | Does |
|---|---|
| `invana agents external add <card-url> --name` · `invana agents external add --mcp <server> --name` | Add an outside agent by its card or its outside MCP server |
| `invana agents external refresh` · `on` · `off` · `list` | Read the card again · turn on · off · list |

### Mechanisms

| Mechanism | How |
|---|---|
| `work.spawn_agent` | A step, side effect `write`, declaring the need Run `agent/*`: writes a `helper` agent attached to its parent's Access Policies, its `soul` and `soul_traits` copied, owned by the person behind the run; skills named at spawn (AG-F04) |
| `work.delegate` | A step: `decide(caller, person, run, agent/<callee>)` for each agent on the chain — Allow runs; Ask raises an ask of kind `delegation`, routed to the caller's named approvers, and waits on its verdict; Deny, no rule and a loop refuse ([AC-F05 › Mechanisms](../../../../os/access/features/AC-F05-asks-and-approvals/feature.md#mechanisms)) |
| `await_children` | The parent's step waits on its live helpers, delegated runs and outside tasks |
| `work.delegate_external` | A step, side effect `send`: hands a task over A2A, or calls the outside MCP server's tool, from a worker that can reach it, under the outside agent's limits, writing its ledger row first; the parent's step waits on it as on a helper |
| Make a helper, in order | 1 · `decide` the need Run `agent/*` and check depth and helpers against the caller's limits, refusing by the first that fails · 2 · write the helper's `agents` row and its policy attachments · 3 · write the child run and take `escrow_tokens` from the caller's remaining tokens a run · 4 · queue the child run's first step. Spawning is a record; a worker that takes the queued step runs it |
| The caller chain | Each run carries its chain of agents from the root; at every step `decide()` runs once per agent on it, each with the same person, and the strictest effect wins ([AC-F04 › Mechanisms](../../../../os/access/features/AC-F04-what-an-agent-may-touch/feature.md#mechanisms)) |
| Ask by default for outside agents | A rule whose resource is `agent/*` matches an `external` agent at most as Ask; only a rule naming `agent/<name>` may Allow it |
| What is sent | The skill's marked fields, each read under the caller chain's Read rules; each property's sensitive mark is checked first and refuses the step, naming it, before anything is written to the ledger |
| A `per_user` outside agent | Called with the account the person behind the run connected ([CP-F02 › Mechanisms](../../../../os/control/features/CP-F02-plugins-and-outside-tools/feature.md#mechanisms)); with none, the step is refused naming the outside agent |
| Escrow | Unspent `escrow_returned` goes back at settle with `agents.runs.escrow_return` |
| Who made whom | Edges are `parent_agent_id`, `spawned_in_run_id` and the delegation events, each edge naming its event; *on behalf of* is read from the event of each hand-off, never from the agent row |
| Helpers end with the work | A task's close retires the helpers made for it (`retire_ephemeral_for_task`) |
| An outside agent | An `agents` row with `kind = external` and no instructions or soul; its limits are `agents_external_agents.limits`; its owners the Admin who added it |
| The A2A client | The optional extra `invana[a2a]`, speaking A2A 1.0 |

## System impact

| HLD section | Change | NFRs |
|---|---|---|
| § 6 Data and storage | Two tables in Postgres; helpers and outside agents are `agents` rows; a secret sealed with the install key | — |
| § 8 APIs and events | The routes, events and CLI above, under `/api/v1/agents` | — |
| § 9 Distributed execution | A helper or delegated run is a queued child run; its tokens are escrowed from the caller's | — |
| § 10 AI and agents | Handing on is a Run on `agent/<name>`; the callee runs narrowed by every caller and the person's teams; what comes back is data | — |
| § 11 Failure modes and the outside boundary | Outside agents over A2A and MCP, called from workers; only what may leave is sent, every send ledgered | — |
| § 12 Qualities | Security: an outside agent's credential is sealed or per person; a hand-off out asks first unless a rule names it | — |

## Decisions

| Decision | Detail |
|---|---|
| Who made whom is drawn | On the run's *Who did what*: the person or task, the first agent, every helper and delegated agent with its state, its depth and its tokens against what it was given; many helpers under one agent collapse to a count |
| The floor is drawn | Each helper reads its depth; a refusal at a limit is drawn in place, naming it |
| A callee's reach reads beside its caller's | What it may touch and its tokens, the caller's beside the callee's, with the rule that narrowed each |
| On behalf of | Read from the record of each hand-off, never restated by the agent |
| Retired helpers stay drawn | Marked retired, still selectable |
| Depth and helpers are the limits' | Depth is the caller's `max_depth`; helpers in all is its `max_helpers` — its fan-out ([CP-F04](../../../../os/control/features/CP-F04-limits/feature.md)) |
| An ask is routed by the caller | A delegation ask goes to the named approvers of the agent whose rule said Ask — never the callee's owners, never the person it benefits |
| *Allow always* is an Admin's policy change | An approver's *Allow always* opens a proposed rule for an Admin to save; the ask itself allows only this hand-off |
| An outside agent is added by its A2A card or its MCP server | The A2A agent card — at `/.well-known/agent-card.json` or the address an Admin gives — or an outside MCP server already added in the Control Plane; its name, version, skills, interfaces and how it signs in are kept as they were read; a change on its side reaches nothing until an Admin reads it again. The A2A version Invana speaks is pinned in [System design § 11](../../../../system-design.md#11-failure-modes-and-the-outside-boundary) › *Standards* |
| An outside agent is an agent | Listed in Agents as *Outside*; it shows in Flow, Runs, *Access usage* and *What left the platform* like any agent, and is never given a task by a person |
| MCP carries tools, A2A carries tasks | An A2A task asks back, has states and returns what it made; an MCP outside agent is a server's tools called as one request and one answer each |
| Calls go out from workers | From workers that can reach it; nothing passes through a hosted service |
| A helper lives for the work | It retires when the work closes; a helper makes helpers only when its own policies allow Run `agent/*` |
| An agent's helpers read over a window | Its sheet lists the helpers it made in 7, 30 or 90 days, each with its run; who made whom inside one run is the run's |
| Outside agents live in Agents | *Agents › Outside agents* lists and adds them; it is the board `agents.external` |

## Open questions

| Question | Who answers |
|---|---|

## Not building

| Item | Why not |
|---|---|
| Helpers that outlive the work | An agent that outlives its reason accumulates silently |
| A *May delegate to* list on the agent | Who an agent may hand work to is a rule on its Access Policies |
| A callee wider than its caller | Every hop narrows; nothing handed on does what the root was denied |
| Agents chatting with each other | Delegation is a task with a verdict; an agent asks a person, never another agent |
| Editing who made whom | It is what happened |
| An org chart of agents | Who made whom is causal, not a hierarchy |
| Outside agents delegating into the deployment | An outside agent reaches the deployment over its MCP server, as a connected client or under a key (CP-F02 · AC-F11) |
| An outside agent applying its own result | A person merges or publishes |
| Chatting with an outside agent | A hand-off is a task with a verdict |
| Paying an outside agent from Invana's tokens | Its cost is its own; Invana bounds it by time, attempts and tasks at once |
| An outside agent's credential in an environment variable | Sealed in Postgres or each person's own account |
