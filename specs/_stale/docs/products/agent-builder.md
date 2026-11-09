# Agent Builder — build agents and skills once, for the whole deployment

Where agents and skills are made. A platform product, off any Graph, beside Home, Datasets, Fleet and
Settings. A Graph never builds: it invites agents from here as members, beside people, and reads what
they did in its Activity. A Graph has no Agents product. Product spec: [AG-F02](../../specs/capabilities/agents/features/AG-F02-the-agents-catalogue/feature.md).

| | |
|---|---|
| For | install Admins |
| Scope | The deployment |
| Rail | Overview │ Agents · Skills · Functions · Library │ Performance · Import and export |
| Core rule | Agent → skills → functions. Agents and skills are built here; functions are read-only code; only agents are invited to a Graph |

## Decisions

| Decision | Detail |
|---|---|
| Builds, and reads how its agents do | The Builder knows nothing of budgets or one Graph's data. **Overview** and **Performance** read each agent and skill version across Graphs; runs, approvals and the ledger are each Graph's Activity |
| Install settings | Graphs (each Graph's monthly tokens, lanes, worker pools) · LLMs · Worker pools · Plugins · MCP servers — install Admin only |

## Not building

| Item | Why |
|---|---|
| Budgets or run views in the Builder | They belong to the Graph that spends and runs |
