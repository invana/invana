# Integrations

What Invana talks to outside itself, and the rule each crossing keeps. The graph connector contract and each
connector's engine shape are [modules/graph-connectors.md](modules/graph-connectors.md).

## Graph databases

One Graph binds to exactly one graph database, through its graph connector package.

| Language | Databases |
|---|---|
| openCypher | Neo4j · Memgraph · ArcadeDB |
| Gremlin | JanusGraph · Amazon Neptune · TinkerGraph · ArcadeDB |
| Vector search | The database's own index, where it has one |

| Rule | Detail |
|---|---|
| Tested before saved | A connection is saved only after a passing test |
| Capabilities are the server's | What a database version can hold is enforced when a model is authored |
| A lens is enforced or refused | A connector that cannot enforce a view of the graph says so rather than report one it did not apply |
| Registered by entry point | A connector package declares itself under the Python entry-point group `invana.connectors`; the engine finds installed connectors there and nowhere else |

## Outside systems

| System | Reached through | Rule |
|---|---|---|
| **AI models** | An LLM provider an Admin adds, with its exact model versions | Agents, skills and judges pin a model version; every run records the one it called |
| **The web · mail · science sources** | Tool plugins Invana ships — each an MCP server on the workers — that an Admin turns on | Every row cites its source; a send always asks first |
| **MCP servers** | A tool plugin an Admin adds by address; its tools become functions, frozen until refreshed | Switched on and off like any tool plugin |
| **Remote agents** | A2A, by the agent's A2A card | Asked each time; only allowed fields are sent; what it returns goes to a person |
| **Outside agents calling in** | This Graph's MCP server and the read-only retrieval API, with a scoped token | Every call is a run in History; the outside surface never writes, except draft dataset versions a person publishes |
| **Channels** | Email · Slack · webhook | Anything leaving Invana waits on a named approver; at its deadline it is *expired, not sent* |
| **Telemetry** | OpenTelemetry traces, metrics and logs | Optional — `INVANA_TELEMETRY_ENABLED` switches it |

## Standards

The open formats and protocols Invana reads and writes, each at one pinned version. A format with no version upstream
is pinned by the date it was read; moving any pin is a spec change.

| Standard | For | Invana | Pinned | Specified in |
|---|---|---|---|---|
| Agent Skills — the `SKILL.md` folder | Skills | Reads and writes; Invana's fields under `metadata:` | agentskills.io specification, read 2026-11-09 (unversioned upstream) | [AG-F04](../capabilities/agents/features/AG-F04-skills/feature.md) · [AG-F08](../capabilities/agents/features/AG-F08-portable-agents-and-skills/feature.md) |
| Agent file — Markdown with YAML front matter, Claude-style | Agents | Reads and writes; Invana's fields under `metadata:` | Claude Code subagent file, read 2026-11-09 (unversioned upstream) | [AG-F08](../capabilities/agents/features/AG-F08-portable-agents-and-skills/feature.md) |
| `AGENTS.md` | Agents | Reads only | agents.md, read 2026-11-09 (unversioned upstream) | [AG-F08](../capabilities/agents/features/AG-F08-portable-agents-and-skills/feature.md) |
| Codex agent file — TOML | Agents | Reads only | Codex CLI agent TOML, read 2026-11-09 (unversioned upstream) | [AG-F08](../capabilities/agents/features/AG-F08-portable-agents-and-skills/feature.md) |
| Claude plugin bundle — `.claude-plugin/plugin.json` | Agents, skills, the MCP servers it names | Reads only | Claude Code plugin manifest, read 2026-11-09 (unversioned upstream) | [AG-F08](../capabilities/agents/features/AG-F08-portable-agents-and-skills/feature.md) |
| Model Context Protocol | Tool plugins, shipped and added · this Graph's own server | Client and server, Streamable HTTP | `2026-07-28` | [RT-F02](../os/runtime/features/RT-F02-plugins-and-outside-tools/feature.md) |
| JSON Schema | Every function's inputs and outputs | Reads and writes | Draft 2020-12 | [RT-F02](../os/runtime/features/RT-F02-plugins-and-outside-tools/feature.md) |
| Agent2Agent (A2A) — the agent card | Outside agents | Client: reads cards, sends tasks | `1.0` | [AG-F05](../capabilities/agents/features/AG-F05-delegation-and-outside-agents/feature.md) |
| Python entry points (PyPA) | Graph connectors | The group `invana.connectors` | Entry points specification, as packaged by the engine's Python | This file › *Graph databases* |
| Python | Skill scripts, in the sandbox | Runs them unchanged | The engine's Python, 3.14 | [RT-F06](../os/runtime/features/RT-F06-skill-scripts/feature.md) |

| Rule | Detail |
|---|---|
| One pin each | Invana speaks the pinned version; a file or card at another version is read only when the spec says so, and otherwise refused naming both |
| Invana's own stay Invana's | Simulator plugins, core plugins, plans and evals have no open standard; they stay Invana's own formats |
| Read many, write one | Agents are written as the Markdown agent file, skills as `SKILL.md` folders; every other agent format is read only |
