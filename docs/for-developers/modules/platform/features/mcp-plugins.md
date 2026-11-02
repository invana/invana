# MCP plugins

An install Admin connects an MCP server; its tools become task types in a plugin of kind `mcp`, one
plugin per server. The tool list is **frozen when the server is added** — what the server offers
later reaches no plan until an Admin refreshes it — and the plugin is switched on and off like a
[tool plugin](tool-plugins.md), and runs where tool steps run.

| | |
|---|---|
| Index | [13.13](../../../README.md#13--platform) · Slice **B07** |
| Module | [Platform](../spec.md) |
| API / CLI / Studio | ✅ / ✅ / 🔵 — the Agents › Plugins surface is C03 |
| Related | [tool plugins](tool-plugins.md) · [plugins](plugins.md) · [approvals](../../operate/features/approvals.md) · [products › plugins §2, §9](../../../../products/plugins.md#2-code-layout) · [products › agents AG-13](../../../../products/agents.md) |

Product spec: [ST-F04 · Plugins and outside tools](../../../../../specs/products/settings/features/ST-F04-plugins-and-outside-tools/feature.md) — ST-26; the story, its criteria, journey, states and product rules live there. This file keeps the engine shape and the rows not moved.

## Capabilities

| # | Capability | Notes |
|---|---|---|
| C2 | One plugin per server | `invana.mcp.<name>`, `kind = "mcp"`, version `<revision>.0.0`; each tool is the task type `mcp.<name>.<tool>`, bound `network` |
| C5 | Loaded at start | Every process — API, CLI, `invana worker` — adds the stored MCP plugins to its registry when it starts; an add or refresh says `restart_required` |
| C7 | Call a tool | One step is one `tools/call`; its outputs are `text`, `content` and `structured` |
| C9 | A bearer token, in the worker | The plugin declares one secret, `mcp_<name>`; when `INVANA_SECRET_MCP_<NAME>` is set it is sent as `Authorization: Bearer …` |
| C10 | Optional extra | `invana[mcp]` installs the MCP SDK; without it no server is added and none loads |

## Journey

```mermaid
sequenceDiagram
    participant A as Admin (CLI / API)
    participant E as Engine
    participant S as MCP server
    participant DB as mcp_servers
    A->>E: mcp add URL --name files
    E->>S: initialize · tools/list (every page)
    S-->>E: tools
    E->>DB: name · url · revision 1 · tools frozen
    E-->>A: restart_required
    Note over E: next start of every process
    E->>DB: read every server
    E->>E: one mcp plugin per row joins the frozen registry
```

## Seams

| Seam | What happens |
|---|---|
| Added, not yet restarted | Listed `installed: false`, `restart_required: true`; its task types are not in this process's registry, so a plan naming one is refused by the validator. Enabling it is allowed — it is a gate and takes effect once loaded |
| Refreshed, not yet restarted | The process keeps serving the revision it loaded; the listing shows that version and `restart_required: true` |
| API and worker on different revisions | A worker that has not restarted does not carry the new `key@version` and fails the step `defect · unknown_task_type` — restart workers with the API |
| The extra is missing at start | Stored servers do not load; they are listed `installed: false` with the extra `mcp` |

## Engine

| Path | Holds |
|---|---|
| `plugins/mcp/client.py` | `list_tools(url, token)` and `call_tool(url, token, name, args)` over the SDK's Streamable HTTP client; the failure mapping |
| `plugins/mcp/plugin.py` | `freeze(tools, previous)` — the frozen list with per-tool versions; `to_plugin(server)` — one `LoadedPlugin` from a stored server |
| `plugins/__init__.py` | `install_mcp(plugins)` — appends the MCP plugins to the frozen registry, once at start-up |
| `runtime/catalogue/__init__.py` | `sync()` — re-derives `CATALOGUE` and `TASKS` from the registry after `install_mcp` |
| `runtime/managers/mcp.py` | `McpManager` — `add`, `refresh`, `get`, `load` (what start-up calls) |
| `runtime/managers/plugins.py` | `SWITCHABLE = {tool, mcp}`; stored-but-unloaded servers in the listing |
| `runtime/executor.py` | an `mcp` step is gated and routed like a tool step |
| `server/app.py` · `cli/context.py` | `McpManager().load(session)` at start-up, before the runtime is built |
| `server/plugins/` | `POST /plugins/mcp` · `POST /plugins/mcp/{name}/refresh`; the `mcp_servers` admin view |
| `cli/commands/plugins.py` | `invana plugins mcp add · refresh` |

| `mcp_servers` column | Type | Notes |
|---|---|---|
| `name` | String(32), PK | `[a-z][a-z0-9_]{0,31}` — the plugin is `invana.mcp.<name>` |
| `url` | String(2048) | the Streamable HTTP endpoint |
| `revision` | int | 1 on add, +1 on each refresh; the plugin version is `<revision>.0.0` |
| `tools` | JSON | `[{name, version, title, description, input_schema, annotations}]` as frozen |
| `skipped` | JSON | tool names that could not be keyed |
| `server` | JSON | `{name, version, protocol}` from `initialize` |
| `frozen_at` | timestamptz | when the tool list was last read |
| `added_by_id` | String(36), nullable | the Admin who added or last refreshed it |

| Endpoint | Who | Returns |
|---|---|---|
| `POST /api/v1/plugins/mcp` `{name, url}` | install Admin | 201 `McpServerRead`; 403 not an Admin · 409 name taken or extra missing · 422 bad name or server unreachable |
| `POST /api/v1/plugins/mcp/{name}/refresh` | install Admin | `McpServerRead`; 404 unknown · 422 unreachable |
| `GET /api/v1/plugins` · `/plugins/{name}` | any signed-in user | as [13.12](tool-plugins.md), MCP plugins included; `restart_required` on each row |

| `McpServerRead` field | Type | Notes |
|---|---|---|
| `name` · `plugin` · `url` | str | `plugin` is `invana.mcp.<name>` |
| `revision` | int | the stored revision |
| `loaded_revision` | int, nullable | what this process loaded; null when not loaded |
| `restart_required` | bool | `loaded_revision != revision` |
| `tools` | `[{key, version, side_effect, summary}]` | as frozen |
| `skipped` | list[str] | |
| `server` | obj | `{name, version, protocol}` |
| `frozen_at` | datetime | |

| Task manifest field | From the tool |
|---|---|
| `key` | `mcp.<server>.<tool name>` |
| `summary` | its `title` or first line of `description` |
| `args` | each top-level `inputSchema` property — `string · integer · number · boolean · array · object` → `str · int · float · bool · list · obj`, a nullable union by its other type, anything else `obj`; `required` and `default` as declared |
| `outputs` | always `text: str` · `content: list` · `structured: obj` |
| `side_effect` | `read` when `annotations.readOnlyHint` is true, else `send` |
| `bound` · `timeout_s` · `retries` · `resources` | `network` · 60 · 0 · `cpu` |

## Decisions

| # | Decision |
|---|---|
| MC1 | **One MCP server is one plugin.** `invana.mcp.<name>` of kind `mcp`, its tools the task types `mcp.<name>.<tool>`. The `plugins/mcp/` package is the code that makes them, not a plugin itself. |
| MC3 | **A refresh is a new revision; a tool's version moves only when its declaration does.** The plugin is `<revision>.0.0`; a new tool is `1.0.0`, a changed input schema, description or annotations bumps the tool's major, an unchanged tool keeps its version, a dropped tool leaves the registry. |
| MC4 | **MCP plugins join the registry at start-up, read from `mcp_servers`.** The registry stays frozen per process; an add or refresh takes effect when each process restarts, so the API and every worker serve the same revision. Enabling stays a gate (13.12 TP1) and needs no restart. |
| MC6 | **MCP steps run where tool steps run** — on the `tools` queue under `procrastinate`, in-process under `inline`. A call's effects are the server's, so it is treated as third-party work. |
| MC8 | **Every MCP task type has the same three outputs** — `text`, `content`, `structured` — because a tool's output schema is optional and its content is a list of blocks. |
| MC9 | **One optional bearer token per server**, the secret `mcp_<name>`, read where the call is made: the API process for add and refresh, the worker for a step. No OAuth flow this slice. |

## Not building

| Not building | Because |
|---|---|
| Removing a server | disabling it stops every call; a removal would orphan the versions old runs recorded |
| Keeping superseded revisions callable | a refresh replaces the revision; a re-run on an old tool version is refused as unknown |
| The Agents › Plugins screen | C03 |
