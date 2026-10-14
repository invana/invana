"""The MCP client — list a server's tools, call one — over the SDK's Streamable HTTP transport.

docs/for-developers/modules/platform/features/mcp-plugins.md. Every call opens
its own session (``initialize``, then the one request) and closes it: an MCP
step is one envelope on whichever worker took it, so there is no connection
to keep. The SDK (``invana[mcp]``) owns the protocol; this module only maps
what can go wrong onto the engine's failure classes:

| What happened | Raised |
|---|---|
| connect refused, DNS, timeout, a 5xx, not MCP | :class:`McpUnreachable` (``transient · mcp_unreachable``) |
| a 401 or 403 | :class:`McpUnauthorized` (``blocked · mcp_unauthorized``) |
| the server answered the call with an error | :class:`McpToolError` (``blocked · mcp_tool_error``) |

Usage::

    from invana.plugins.mcp import client

    server, tools = await client.list_tools("http://localhost:9000/mcp", token=None)
    result = await client.call_tool("http://localhost:9000/mcp", None, "read_file", {"path": "a.txt"})
"""

from __future__ import annotations

import asyncio
from collections.abc import Awaitable, Callable
from typing import Any

import httpx

#: Seconds one list or call may take end to end, connection included.
CALL_TIMEOUT_S = 60.0
#: Pages of ``tools/list`` read before giving up on a server that never stops paging.
MAX_PAGES = 50


class McpError(Exception):
    """Something between Invana and an MCP server failed; ``cause`` is the machine code."""

    cause = "mcp_error"

    def __init__(self, message: str, *, url: str) -> None:
        super().__init__(message)
        self.url = url


class McpUnreachable(McpError):
    cause = "mcp_unreachable"


class McpUnauthorized(McpError):
    cause = "mcp_unauthorized"


class McpToolError(McpError):
    cause = "mcp_tool_error"


def _leaves(exc: BaseException) -> list[BaseException]:
    if isinstance(exc, BaseExceptionGroup):
        return [leaf for inner in exc.exceptions for leaf in _leaves(inner)]
    return [exc]


def _mapped(exc: BaseException, url: str) -> McpError:
    """The one error a person can act on, out of whatever the transport raised."""
    for leaf in _leaves(exc):
        if isinstance(leaf, McpError):
            return leaf
        if isinstance(leaf, httpx.HTTPStatusError) and leaf.response.status_code in (401, 403):
            return McpUnauthorized(f"{url} refused the request ({leaf.response.status_code}).", url=url)
    leaf = _leaves(exc)[0]
    return McpUnreachable(f"Could not reach the MCP server at {url}: {type(leaf).__name__}: {leaf}", url=url)


async def _with_session(url: str, token: str | None, act: Callable[[Any], Awaitable[Any]]) -> Any:
    from mcp import ClientSession
    from mcp.client.streamable_http import streamable_http_client

    headers = {"Authorization": f"Bearer {token}"} if token else {}
    try:
        async with asyncio.timeout(CALL_TIMEOUT_S):
            async with httpx.AsyncClient(headers=headers, timeout=CALL_TIMEOUT_S, follow_redirects=True) as http:
                async with streamable_http_client(url, http_client=http) as (read, write, _):
                    async with ClientSession(read, write) as session:
                        init = await session.initialize()
                        return await act(session), init
    except McpToolError:
        raise
    except (Exception, BaseExceptionGroup) as exc:
        raise _mapped(exc, url) from exc


async def list_tools(url: str, token: str | None) -> tuple[dict, list[dict]]:
    """``({name, version, protocol}, [tool as JSON, …])`` — every page of ``tools/list``."""

    async def act(session: Any) -> list[dict]:
        tools: list[dict] = []
        cursor: str | None = None
        for _ in range(MAX_PAGES):
            page = await session.list_tools(cursor)
            tools += [t.model_dump(mode="json", by_alias=True, exclude_none=True) for t in page.tools]
            cursor = page.nextCursor
            if not cursor:
                break
        return tools

    tools, init = await _with_session(url, token, act)
    server = {"name": init.serverInfo.name, "version": init.serverInfo.version, "protocol": init.protocolVersion}
    return server, tools


async def call_tool(url: str, token: str | None, name: str, arguments: dict) -> dict:
    """``{text, content, structured}`` for one ``tools/call``; :class:`McpToolError` when the tool failed."""

    async def act(session: Any) -> dict:
        result = await session.call_tool(name, arguments)
        content = [block.model_dump(mode="json", by_alias=True, exclude_none=True) for block in result.content]
        text = "\n".join(block["text"] for block in content if block.get("type") == "text")
        if result.isError:
            raise McpToolError(text or f"The tool {name} failed and said nothing more.", url=url)
        return {"text": text, "content": content, "structured": result.structuredContent or {}}

    out, _ = await _with_session(url, token, act)
    return out
