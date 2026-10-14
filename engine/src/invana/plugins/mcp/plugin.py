"""One MCP server → one plugin of kind ``mcp`` whose task types are the server's frozen tools.

docs/for-developers/modules/platform/features/mcp-plugins.md. Two halves:

| Function | When |
|---|---|
| :func:`freeze` | when an Admin adds or refreshes a server — the tool list as stored, each tool with its version |
| :func:`to_plugin` | at every process start — a stored server read back as a :class:`LoadedPlugin` |

A frozen tool keeps its version across a refresh while its declaration
(description, input schema, annotations) is unchanged; a changed one takes the
next major, a new one starts at ``1.0.0``. Every task type of the plugin runs
the same body, :func:`_runner`, bound to its server and tool name.

Usage::

    tools, skipped = freeze(listed, previous=row.tools)
    plugin = to_plugin(name="files", url=url, revision=2, tools=tools)
"""

from __future__ import annotations

import re
from typing import Any

from invana.plugins.mcp import client
from invana.plugins.registry import LoadedPlugin
from invana.plugins.sdk.context import Out, RunVars, TaskContext
from invana.plugins.sdk.errors import TaskFailure
from invana.plugins.sdk.manifest import Arg, Bound, PluginManifest, Resource, SideEffect, TaskManifest, Type

#: An MCP server's name in Invana — the last segment of its plugin and the middle of its keys.
SERVER_NAME = re.compile(r"^[a-z][a-z0-9_]{0,31}$")
#: A tool name that can sit in a task key as it is.
TOOL_NAME = re.compile(r"^[A-Za-z0-9_-]{1,64}$")
#: The extra that installs the SDK every MCP plugin needs.
EXTRA = "mcp"
#: What every MCP task type returns — a tool's own output schema is optional.
OUTPUTS = {"text": Type.str_, "content": Type.list_, "structured": Type.obj}
TIMEOUT_S = 60

_JSON_TYPES = {
    "string": Type.str_,
    "integer": Type.int_,
    "number": Type.float_,
    "boolean": Type.bool_,
    "array": Type.list_,
    "object": Type.obj,
}


def plugin_name(server: str) -> str:
    return f"invana.mcp.{server}"


def secret_name(server: str) -> str:
    """The one secret a server's plugin declares — a bearer token in ``INVANA_SECRET_MCP_<NAME>``."""
    return f"mcp_{server}"


def task_key(server: str, tool: str) -> str:
    return f"mcp.{server}.{tool}"


def _declaration(tool: dict) -> dict:
    return {k: tool.get(k) for k in ("description", "input_schema", "annotations")}


def freeze(listed: list[dict], previous: list[dict] | None = None) -> tuple[list[dict], list[str]]:
    """The tools as stored, each with its version, and the names that cannot be keyed.

    ``listed`` is ``tools/list`` as JSON; ``previous`` the stored list of the
    revision being replaced, if any.
    """
    before = {t["name"]: t for t in previous or ()}
    tools: list[dict] = []
    skipped: list[str] = []
    for raw in listed:
        name = str(raw.get("name", ""))
        if not TOOL_NAME.match(name) or any(t["name"] == name for t in tools):
            skipped.append(name)
            continue
        tool = {
            "name": name,
            "title": raw.get("title") or (raw.get("annotations") or {}).get("title") or "",
            "description": raw.get("description") or "",
            "input_schema": raw.get("inputSchema") or {},
            "annotations": raw.get("annotations") or {},
        }
        old = before.get(name)
        if old is None:
            tool["version"] = "1.0.0"
        elif _declaration(old) == _declaration(tool):
            tool["version"] = old["version"]
        else:
            tool["version"] = f"{int(str(old['version']).split('.', 1)[0]) + 1}.0.0"
        tools.append(tool)
    return tools, skipped


def _arg_type(schema: dict) -> Type:
    kind = schema.get("type")
    if isinstance(kind, list):
        kind = next((k for k in kind if k != "null"), None)
    if kind is None:
        options = [o for o in schema.get("anyOf", schema.get("oneOf", ())) if o.get("type") != "null"]
        if len(options) == 1:
            return _arg_type(options[0])
    return _JSON_TYPES.get(kind, Type.obj) if isinstance(kind, str) else Type.obj


def _args(schema: dict) -> dict[str, Arg]:
    required = set(schema.get("required") or ())
    return {
        name: Arg(_arg_type(prop if isinstance(prop, dict) else {}), name in required, (prop or {}).get("default"))
        for name, prop in (schema.get("properties") or {}).items()
    }


def summary(tool: dict) -> str:
    return tool.get("title") or (tool.get("description") or "").strip().split("\n", 1)[0][:200]


def side_effect(tool: dict) -> SideEffect:
    """``read`` only when the server marks the tool read-only; anything else waits on an approval."""
    return SideEffect.read if (tool.get("annotations") or {}).get("readOnlyHint") is True else SideEffect.send


def _token(ctx: TaskContext, server: str) -> str | None:
    try:
        return ctx.secret(secret_name(server))
    except TaskFailure as exc:
        if exc.cause == "secret_missing":
            return None
        raise


def _runner(server: str, url: str, tool: str):
    """The body of ``mcp.<server>.<tool>``: one ``tools/call`` with the step's args."""

    async def run(ctx: TaskContext, v: RunVars) -> Out:
        args = dict(ctx.step.args or {})
        try:
            result = await client.call_tool(url, _token(ctx, server), tool, args)
        except client.McpError as exc:
            env = f"INVANA_SECRET_{secret_name(server).upper()}"
            hint = f" Set {env} where the step runs." if isinstance(exc, client.McpUnauthorized) else ""
            raise TaskFailure(
                cls="transient" if isinstance(exc, client.McpUnreachable) else "blocked",
                cause=exc.cause,
                message=f"{exc}{hint}",
                short={"mcp_unreachable": "MCP server unreachable", "mcp_unauthorized": "MCP unauthorised"}.get(
                    exc.cause, "MCP tool failed"
                ),
                evidence={"server": server, "url": url, "tool": tool},
            ) from exc
        ctx.artifact(url, direction="read", summary=f"{server} · {tool}")
        return Out(
            detail=f"{server} · {tool} · {len(result['content'])} blocks",
            input={"tool": tool, "args": args},
            output=result,
        )

    return run


def to_plugin(*, name: str, url: str, revision: int, tools: list[dict[str, Any]]) -> LoadedPlugin:
    """A stored server as the plugin the registry carries."""
    manifest = PluginManifest(
        name=plugin_name(name),
        version=f"{revision}.0.0",
        kind="mcp",
        extra=EXTRA,
        secrets=(secret_name(name),),
        title=name,
    )
    return LoadedPlugin(
        manifest=manifest,
        tasks=tuple(
            TaskManifest(
                key=task_key(name, tool["name"]),
                version=tool["version"],
                summary=summary(tool),
                bound=Bound.network,
                run=_runner(name, url, tool["name"]),
                side_effect=side_effect(tool),
                args=_args(tool.get("input_schema") or {}),
                outputs=OUTPUTS,
                resources=(Resource.cpu,),
                timeout_s=TIMEOUT_S,
                retries=0,
                plugin=manifest.name,
            )
            for tool in tools
        ),
        flows=(),
    )
