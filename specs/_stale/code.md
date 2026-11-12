# Code the M3 audit deletes

The paths the M3 audit and Ravi's answers delete. The phase that deletes them removes these and nothing else.

## Deleted

| Path | Why |
|---|---|
| — | Nothing: the `web`, `mail` and `science` tool plugins stay, each as an MCP server ([RT-F02 › Decisions](../os/runtime/features/RT-F02-plugins-and-outside-tools/feature.md#decisions)) |

Every other engine, Studio and integration source is kept: each unreferenced engine module is an Alembic revision or a
plugin loaded by path, and every Studio package serves a story.

## Kept

| File | Why |
|---|---|
| — | No stale code file is kept in `_stale/` |
