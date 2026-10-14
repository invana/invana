"""MCP plugins — an MCP server's tools as task types
(docs/for-developers/modules/platform/features/mcp-plugins.md).

Not a plugin itself: the code that turns each server an install Admin added
into one plugin of kind ``mcp``. The tool list is frozen in ``mcp_servers``
when the server is added or refreshed, and every process reads it back into
its registry once, at start-up (:func:`invana.plugins.install_mcp`).

| Module | Holds |
|---|---|
| ``client`` | ``list_tools`` · ``call_tool`` over the SDK's Streamable HTTP client, and the failure mapping |
| ``plugin`` | ``freeze`` — the stored tool list with versions · ``to_plugin`` — a stored server as a ``LoadedPlugin`` |
"""
