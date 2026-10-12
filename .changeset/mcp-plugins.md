---
"invana": minor
---

MCP plugins: connect an MCP server, and its tools become task types agents can call once an install Admin enables it.

- `invana plugins mcp add <url> --name <name>` (or `POST /api/v1/plugins/mcp`) connects over Streamable HTTP and freezes the server's tools as the plugin `invana.mcp.<name>`, each tool the task type `mcp.<name>.<tool>`. What the server offers later reaches no plan until an Admin runs `invana plugins mcp refresh <name>`; a tool's version moves only when its declaration changed.
- An added or refreshed server loads when the engine and each worker restart; until then it is listed as not loaded, with `restart_required`.
- It is enabled and disabled like a tool plugin — `invana plugins enable invana.mcp.<name>` — and its steps run where tool steps run.
- A tool the server marks read-only runs straight away; every other tool waits on an approval in the inbox.
- A bearer token for a server is read from `INVANA_SECRET_MCP_<NAME>` where the call is made — never stored.
- Installs with the `invana[mcp]` extra (included in `all`).
