---
"invana": minor
---

**This Graph's MCP server.** Every Graph now offers one MCP endpoint —
`POST /api/v1/u/{username}/{graphSlug}/mcp`, Streamable HTTP, one JSON answer per call — so Claude
Code, Cursor or any MCP client can use it with a token made in IAM.

| Tool | What it does |
|---|---|
| `validate_records` | checks records against a dataset as a draft push would; writes nothing |
| `push_draft_version` | stores records as a **draft** dataset version; its owner publishes it |
| `ask_<agent>` | asks a served agent one question, as the caller, within the token |

Nothing is served until a builder turns it on, per agent and per function, on **Agents › Connections ›
This Graph's server** or an agent's Deploy tab. The page prints the `claude mcp add` line for the
Graph and lists **Recent calls** — each call is a run, triggered by `mcp`, in Runs and the ledger.

A narrowed token is checked on every call: one narrowed to `data.version.check` ·
`data.version.draft` on one dataset can validate and push drafts of that dataset and nothing else,
and a refusal names the token and its policy. A session sign-in is refused at the endpoint.

New: `GET …/connections/server`, `…/connections/server/served`, `PUT …/served/{kind}/{ref}`,
`GET …/connections/server/calls`; the functions `data.version.check` and `data.version.draft`.
