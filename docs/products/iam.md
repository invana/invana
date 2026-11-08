# Invana IAM (proposal)

**Status: proposal, under review.** Who may do what, to which resources, within which limits — for people and
agents alike, in one place. Prototype: the *Invana — IAM and Scale-out* canvas, pages *IAM › …*.

Product spec: [ST-F02 · People and access](../../specs/foundation/settings/features/ST-F02-people-and-access/feature.md) — IAM-01…IAM-11 are ST-01…ST-11 there, with their criteria, rules and decisions. What is left here has not moved.

| | |
|---|---|
| For | owners and admins of a Graph |
| Job | Attach policies to people, groups, agents and tokens; see what they add up to; widen access on purpose |
| Scope | One Graph. Policies, groups, tokens and connections belong to the Graph |
| Replaces | Graph roles as the access model (they become managed policies), skill allowlists as grants, delegation lists, the scoped tokens of 10.4 |
| Core rule | Allowed only where every layer allows. A refusal names the layer and the policy |

## Decisions

| Decision | Detail |
|---|---|
| Skills declare needs | A skill lists the functions it needs; it grants nothing. A need no policy covers is refused before dispatch |
| Worlds stay | A world is the asker's narrowing for one run — a session policy. It keeps its name and its place in Modeller |
| Delegation | `work.delegate` / `work.spawn_agent` on resource `agent/<name>`. No agent-to-agent chat; an agent asks a **person** |
| Projects | A project is a resource, `project/<name>` — its todos, branches, findings and decisions. A project's people and agents are holders of a policy scoped to it, so its member list and that policy's *Held by* are one record. A private project is readable only by those holders. An agent picks up a todo only in a project it holds a policy for, and its run is bounded by the person who filed or assigned the todo |
| The rail | Home · People, Groups, Agents · Policies, Tokens · Settings |
| Product | IAM is a Graph product, in the launcher's *This Graph* group, on the shared shell — rail, pages, the assistant on the right. An agent's *Access* in Graph settings › Members is its IAM policies, edited here |
