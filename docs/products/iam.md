# Invana IAM (proposal)

**Status: proposal, under review.** Who may do what, to which resources, within which limits — for people and
agents alike, in one place. Prototype: the *Invana — IAM and Scale-out* canvas, pages *IAM › …*.

| | |
|---|---|
| For | owners and admins of a Graph |
| Job | Attach policies to people, groups, agents and tokens; see what they add up to; widen access on purpose |
| Scope | One Graph. Policies, groups, tokens and connections belong to the Graph |
| Replaces | Graph roles as the access model (they become managed policies), skill allowlists as grants, delegation lists, the scoped tokens of 10.4 |
| Core rule | Allowed only where every layer allows. A refusal names the layer and the policy |

## User stories

| ID | As a | I want | So that | Boards |
|---|---|---|---|---|
| IAM-01 | owner | one list of every policy — managed, custom, inline, boundary — and who holds it | access is read in one place | `iam.home` · `iam.policies` |
| IAM-02 | iam-admin | a policy as statements (actions × resources, grouped by layer) with conditions | I grant exactly what is needed | `iam.policy.statements` |
| IAM-03 | iam-admin | limits on a policy — tokens, live agents, descendants, depth, worker-seconds, pools | spend is governed like access | `iam.policy.limits` |
| IAM-04 | iam-admin | a policy as a file I can keep in git | changes are reviewed and versioned | CLI only — `invana iam apply · list · show` |
| IAM-05 | iam-admin | the assistant to draft a policy, and its impact before saving | I never break an agent by accident | `iam.policy.draft` · `iam.policy.impact` |
| IAM-06 | member without iam-admin | to read policies and know who can change them | I know who to ask | `iam.policies.denied` |
| IAM-07 | owner | every agent's policies and effective access, read-only — agents are built in Agents | I see why an agent can or can't | `iam.agents` · `iam.agent.effective` |
| IAM-08 | owner | people, service accounts and groups, and the policies each holds | a team is granted once | `iam.people` · `iam.groups` |
| IAM-09 | person or admin | tokens — keys that act as their holder for scripts, CI and Claude Code — narrowed, expiring, shown once | software pushes data without a person's login | `iam.tokens` · `iam.tokens.new` |
| IAM-10 | iam-admin | everyone holding a policy — people, groups, agents — and to attach it | I see a policy's reach and change it in one place | `iam.policy.held_by` |
| IAM-11 | anyone | to test whether X may do Y to Z, and which layer decides, without running anything | access is proven, not guessed | `iam.policy.test` |

## Decisions

| Decision | Detail |
|---|---|
| Principals | People (members, and **service accounts** — a person with no sign-in that owns tokens for scripts), groups, and agents. A token belongs to one of them. **Agents are built in Agents**; IAM lists them read-only, and a policy can be attached to one from either side — one record. **Workers are not principals** — they hold a pool credential and only run steps |
| A statement | `allow` · actions (function globs, `graph.read.*`) · resources (`layer/sublayer/name` globs) · conditions. Default deny; there is no `deny` statement |
| Resources are layered | graph data · llm · third party (the web, `third_party/mcp/<server>/*`) · cache · human, plus `agent/<name>` for spawn, delegation and calls over MCP, and `project/<name>` for a project's records. The matrix groups rows by layer — the layer view and the grants matrix are one table |
| Policy kinds | **managed** (viewer · contributor · builder · modeller · owner · iam-admin; read-only) · **custom** · **inline** (on one token) · **boundary** (the most anyone in the Graph may do — today's guardrail) |
| Effective access | skill needs ∩ the agent's policies ∩ the person who started the run ∩ the world ∩ the boundary ∩ the token's policy. An agent never does more than the person who started it |
| Skills declare needs | A skill lists the functions it needs; it grants nothing. A need no policy covers is refused before dispatch |
| Worlds stay | A world is the asker's narrowing for one run — a session policy. It keeps its name and its place in Modeller |
| Spawned agents | Hold their parent's access, narrowed; never their own attachments |
| Delegation | `work.delegate` / `work.spawn_agent` on resource `agent/<name>`. No agent-to-agent chat; an agent asks a **person** |
| Limits live in policies | A policy carries ceilings; an agent's own settings sit under them and a setting above one is refused when saved. Usage is metered by the engine at settle time (rule 13) |
| Hitting a limit | live agents and concurrency: wait for a slot · tokens: pause and ask · worker-seconds: the pool stops growing for this Graph |
| Asks go to Approvals | An ask for access or a higher limit is one more kind in Agents › Approvals — the one queue. Allowed, it attaches a policy for this run · N days · always; IAM shows that on the policy's *Held by* and the person, with when it ends. The ledger keeps both |
| Tokens | A key that acts as its holder when software calls Invana — a script, CI, Claude Code over MCP. Carries identity plus an optional inline policy that can only narrow. Shown once, stored hashed, with an expiry. Your own are in your profile; IAM lists every token in the Graph. *New token* is a modal |
| Saving shows impact | Who gains, who loses, which skills would break — before the save |
| Policies as files | `invana iam apply` · `list` · `show`; versioned records like skills |
| Refusals name their policy | In the ledger, the agent's Access tab, its effective access here, and Test access |
| Test access | A modal on a policy (and a person): who · does what · to what · started by → allowed or refused, every layer that decided. The engine's own check, run without running anything |
| Projects | A project is a resource, `project/<name>` — its todos, branches, findings and decisions. A project's people and agents are holders of a policy scoped to it, so its member list and that policy's *Held by* are one record. A private project is readable only by those holders. An agent picks up a todo only in a project it holds a policy for, and its run is bounded by the person who filed or assigned the todo |
| The rail | Home · People, Groups, Agents · Policies, Tokens · Settings |
| Product | IAM is a sixth product in the launcher, on the Agents shell — rail, pages, the assistant on the right. It breaks the README's five-product ceiling on purpose: access spans every product and belongs to none |

## Not building

| Not building | Because |
|---|---|
| Connections — stored OAuth or API keys for third parties | Invana pulls from and pushes to no source in v1. An MCP server's credential lives on the workers (13.13); per-person OAuth comes back only when a third party demands it |
| Sign-in providers in IAM | Password sign-in is enough for v1; single sign-on is install-admin setup, later |
| Requests as their own page | An ask is one more kind in Approvals; IAM shows what was granted |
| Check access as a section | It is a Test access modal on a policy or a person |
| Building agents in IAM | Agents are built in Agents; IAM reads them |
| Explicit `deny` statements | default deny plus a boundary covers it; deny precedence is where IAM gets unreadable |
| Conditions beyond fields, depth and expiry | time windows, IPs and tags are unproven here |
| Policies on workers | workers run any agent's steps; access belongs to the agent |
| Invana as an OAuth provider for third-party apps | tokens cover it at this stage |
| Install-wide policies shared across Graphs | everything is per Graph |
