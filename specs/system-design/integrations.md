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

## Outside systems

| System | Reached through | Rule |
|---|---|---|
| **AI models** | An LLM provider an Admin adds, with its exact model versions | Agents, skills and judges pin a model version; every run records the one it called |
| **The web · mail · science sources** | Tool plugins an Admin enables | Every row cites its source; a send always asks first |
| **MCP servers** | An MCP plugin an Admin adds; its tools become functions, frozen until refreshed | Switched on and off like a tool plugin |
| **Remote agents** | A2A, by the agent's card | Asked each time; only allowed fields are sent; what it returns goes to a person |
| **Outside agents calling in** | This Graph's MCP server and the read-only retrieval API, with a scoped token | Every call is a run in History; the outside surface never writes, except draft dataset versions a person publishes |
| **Channels** | Email · Slack · webhook | Anything leaving Invana waits on a named approver; at its deadline it is *expired, not sent* |
| **Telemetry** | OpenTelemetry traces, metrics and logs | Optional — `INVANA_TELEMETRY_ENABLED` switches it |
