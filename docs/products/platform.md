# Fleet and Settings — the platform's machines and configuration

Two platform products, off any Graph, for install Admins. **Fleet** runs the worker pools every Graph
shares. **Settings** configures the install: LLM providers, plugins, MCP servers, outside agents, and each
Graph's limits. Neither shows a Graph picker. A Graph reads its limits in Graph settings › Usage and never
changes them. See [README › Two places](README.md#two-places).

| | |
|---|---|
| For | install Admins |
| Scope | The platform |
| Fleet rail | Pools · Workers · Capacity · Join tokens |
| Settings rail | Graph limits │ LLM providers · Plugins · MCP servers · Remote agents |

## Stories

SH-23 · AF-10 · AF-11 · AF-17 · AF-18 · AF-19 are ST-16 · ST-24 · ST-25 · ST-26 · ST-27 · ST-28 in [Settings](../../specs/foundation/settings/product.md).

## Decisions

| Decision | Detail |
|---|---|
| Fleet is the machines | *Fleet* names the worker pools and their workers. Agent health is the Agent Builder's Overview, not Fleet |
