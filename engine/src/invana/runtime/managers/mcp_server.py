"""This Graph's MCP server — what it serves, and every call made to it.

docs/for-developers/modules/platform/features/this-graphs-mcp-server.md.

Two jobs, one manager. **What it serves**: the candidates are every agent of the
Graph that is live and not spawned, and the functions in :data:`SERVABLE`; each
has a switch in ``mcp_served``, off until a builder turns it on. **The calls**:
the endpoint speaks MCP's JSON-RPC over Streamable HTTP in its JSON response
mode — ``initialize`` · ``ping`` · ``tools/list`` · ``tools/call`` — and a tool
call is a run, opened here, run inline by the view, and read back here::

    mcp = McpServerManager()
    reply = await mcp.handle(session, graph=graph, caller=user, credential=cred, message=body, session_id=sid)
    if reply.run_id:                      # a tools/call that opened a run
        await session.commit()
        await runtime.run_inline(reply.run_id)
        reply = await mcp.finish(session, run_id=reply.run_id, message=body)

A narrowed token is checked here, per call: each tool is one action on one
resource, read against the token's inline policy, and a refusal opens no run.
An agent's run carries the token in ``params.mcp.token_id`` so the access gate
reads it as a layer for every step.
"""

from __future__ import annotations

import base64
import binascii
import json
import re
import uuid
from dataclasses import dataclass, field
from datetime import UTC, datetime
from typing import Any, Final

from sqlalchemy.ext.asyncio import AsyncSession

from invana.apps.agents.models import Agent, AgentKind, AgentStatus
from invana.apps.agents.querysets import AgentQuerySet
from invana.apps.graphs.models import Graph
from invana.apps.mcp_server.models import McpServed, ServedKind
from invana.apps.mcp_server.querysets import ServedQuerySet
from invana.apps.mcp_server.schemas import McpCallRead, McpServerInfo, ServedRead
from invana.core.auth.models import User
from invana.core.errors import NotFoundError
from invana.core.events import actions
from invana.core.events.services import emit_event
from invana.core.policy import Statement, StatementError, allows, parse_statements, summary
from invana.core.settings import settings
from invana.plugins.registry import engine_version
from invana.runtime import services
from invana.runtime.catalogue import CATALOGUE
from invana.runtime.models import RunStatus, TaskRun
from invana.runtime.querysets import TaskRunQuerySet
from invana.runtime.querysets.access import AccessQuerySet
from invana.runtime.querysets.mcp_calls import McpCallQuerySet

#: Newest first; the first is what a client asking for an unknown version gets.
PROTOCOL_VERSIONS: Final = ("2025-06-18", "2025-03-26", "2024-11-05")
TRANSPORT: Final = "Streamable HTTP"
SESSION_HEADER: Final = "Mcp-Session-Id"
UNKNOWN_CLIENT: Final = "MCP client"

_DATASET_SCHEMA: Final = {"type": "string", "description": "The dataset as publisher/name"}
_RECORDS_SCHEMA: Final = {
    "type": "array",
    "items": {"type": "object"},
    "description": "Flat records, each carrying the dataset's key column",
}


@dataclass(frozen=True, slots=True)
class Servable:
    """A function this server may serve, and the tool it is served as."""

    tool: str
    title: str
    does: str
    input_schema: dict


SERVABLE: Final[dict[str, Servable]] = {
    "data.version.check": Servable(
        tool="validate_records",
        title="Validate records",
        does="checks records against a dataset as a draft would be; writes nothing",
        input_schema={
            "type": "object",
            "properties": {"dataset": _DATASET_SCHEMA, "records": _RECORDS_SCHEMA},
            "required": ["dataset", "records"],
        },
    ),
    "data.version.draft": Servable(
        tool="push_draft_version",
        title="Push a draft version",
        does="pushes records as a draft dataset version; a person publishes",
        input_schema={
            "type": "object",
            "properties": {
                "dataset": _DATASET_SCHEMA,
                "records": _RECORDS_SCHEMA,
                "licence": {"type": "string", "description": "The licence the records are published under"},
                "author_chain": {
                    "type": "array",
                    "items": {"type": "object"},
                    "description": "Who made the records: [{role, kind, name}]; the first is the original author",
                },
                "why": {"type": "string", "description": "What changed, in a line"},
                "source": {"type": "string", "description": "Where the records came from"},
            },
            "required": ["dataset", "records", "licence"],
        },
    ),
}

_ASK_SCHEMA: Final = {
    "type": "object",
    "properties": {"question": {"type": "string", "description": "What to ask, in plain words"}},
    "required": ["question"],
}

# JSON-RPC error codes.
PARSE_ERROR: Final = -32700
INVALID_REQUEST: Final = -32600
METHOD_NOT_FOUND: Final = -32601
INVALID_PARAMS: Final = -32602


@dataclass(frozen=True, slots=True)
class Candidate:
    """One agent or function the server may serve, with its tool."""

    kind: str
    ref: str
    name: str
    tool: str
    does: str
    status: str | None = None
    agent: Agent | None = None


@dataclass(frozen=True, slots=True)
class Credential:
    """The token a call came with — who it is, and what it is narrowed to."""

    token_id: str | None
    token_name: str | None
    #: ``(policy name, raw statements)`` for a narrowed token, else ``None``.
    narrowing: tuple[str, list] | None = None


@dataclass(slots=True)
class Reply:
    """What the endpoint answers: an HTTP status, a JSON-RPC body (or none), headers — or a run to work first."""

    status: int = 200
    body: dict | None = None
    headers: dict[str, str] = field(default_factory=dict)
    #: Set by a ``tools/call`` that opened a run: the view runs it, then calls :meth:`McpServerManager.finish`.
    run_id: str | None = None


def snake(name: str) -> str:
    """``Fare Lead`` → ``fare_lead``."""
    return re.sub(r"[^a-z0-9]+", "_", name.lower()).strip("_") or "agent"


def client_session_id(client: str | None) -> str:
    """A session id that carries the client's name back to every call."""
    name = (client or "").strip()[:64]
    tail = base64.urlsafe_b64encode(name.encode()).decode().rstrip("=") if name else ""
    return f"{uuid.uuid4().hex}.{tail}" if tail else uuid.uuid4().hex


def client_of(session_id: str | None) -> str:
    """The client's name a session id carries, else :data:`UNKNOWN_CLIENT`."""
    _, _, tail = (session_id or "").partition(".")
    if not tail:
        return UNKNOWN_CLIENT
    try:
        name = base64.urlsafe_b64decode(tail + "=" * (-len(tail) % 4)).decode()
    except (binascii.Error, UnicodeDecodeError):
        return UNKNOWN_CLIENT
    name = "".join(ch for ch in name if ch.isprintable()).strip()[:64]
    return name or UNKNOWN_CLIENT


def _ok(msg_id: Any, result: dict) -> dict:
    return {"jsonrpc": "2.0", "id": msg_id, "result": result}


def _error(msg_id: Any, code: int, message: str) -> dict:
    return {"jsonrpc": "2.0", "id": msg_id, "error": {"code": code, "message": message}}


def _tool_result(text: str, *, structured: dict | None = None, is_error: bool = False) -> dict:
    out: dict[str, Any] = {"content": [{"type": "text", "text": text}], "isError": is_error}
    if structured is not None:
        out["structuredContent"] = structured
    return out


class McpServerManager:
    """What this Graph's MCP server serves, and the JSON-RPC every caller speaks to it."""

    served_qs = ServedQuerySet()
    agents_qs = AgentQuerySet()
    calls_qs = McpCallQuerySet()
    runs_qs = TaskRunQuerySet()
    access_qs = AccessQuerySet()

    # ── what it serves ───────────────────────────────────────────────────────

    async def candidates(self, session: AsyncSession, *, graph: Graph) -> list[Candidate]:
        """Every agent and function the server may serve: live agents by name, then the functions."""
        agents = [
            a
            for a in await self.agents_qs.list_active_for_graph(session, graph_id=graph.id)
            if a.kind != AgentKind.spawned.value and a.status == AgentStatus.active.value
        ]
        agents.sort(key=lambda a: a.name.lower())
        tools: dict[str, int] = {}
        for a in agents:
            tools[snake(a.name)] = tools.get(snake(a.name), 0) + 1
        out: list[Candidate] = []
        for a in agents:
            base = snake(a.name)
            tool = f"ask_{base}" if tools[base] == 1 else f"ask_{base}_{a.id[:6]}"
            first = (a.description or "").strip().splitlines()
            does = first[0] if first and first[0] else f"runs {a.name} as the caller"
            out.append(Candidate("agent", a.id, a.name, tool[:64], does, status=a.status, agent=a))
        for key, fn in SERVABLE.items():
            if key in CATALOGUE:
                out.append(Candidate("function", key, key, fn.tool, fn.does))
        return out

    async def served(self, session: AsyncSession, *, graph: Graph) -> list[ServedRead]:
        """The candidates joined to their switches."""
        rows = {(r.kind, r.ref): r for r in await self.served_qs.for_graph(session, graph_id=graph.id)}
        out = []
        for c in await self.candidates(session, graph=graph):
            row = rows.get((c.kind, c.ref))
            out.append(
                ServedRead(
                    kind=c.kind,
                    ref=c.ref,
                    name=c.name,
                    tool=c.tool,
                    does=c.does,
                    served=bool(row and row.served),
                    status=c.status,
                    changed_at=row.changed_at if row else None,
                )
            )
        return out

    async def set_served(
        self, session: AsyncSession, *, graph: Graph, kind: str, ref: str, served: bool, actor: User
    ) -> ServedRead:
        """Turn one candidate's switch on or off; a ref that is not a candidate reads as absent."""
        found = next((r for r in await self.served(session, graph=graph) if r.kind == kind and r.ref == ref), None)
        if found is None or kind not in {k.value for k in ServedKind}:
            raise NotFoundError(f"This Graph's MCP server cannot serve {kind} {ref!r}.")
        row = await self.served_qs.get(session, graph_id=graph.id, kind=kind, ref=ref)
        now = datetime.now(UTC)
        if row is None:
            await self.served_qs.add(
                session,
                McpServed(graph_id=graph.id, kind=kind, ref=ref, served=served, changed_by_id=actor.id, changed_at=now),
            )
        elif row.served != served:
            row.served, row.changed_by_id, row.changed_at = served, actor.id, now
            await session.flush()
        return found.model_copy(update={"served": served, "changed_at": now})

    async def info(self, session: AsyncSession, *, graph: Graph, username: str) -> McpServerInfo:
        """The endpoint card, the Claude Code line and the head's counts."""
        url = f"{settings.engine_base_url.rstrip('/')}/api/v1/u/{username}/{graph.slug}/mcp"
        rows = await self.served(session, graph=graph)
        midnight = datetime.now(UTC).replace(hour=0, minute=0, second=0, microsecond=0)
        command = (
            f"claude mcp add --transport http invana-{graph.slug} \\\n"
            f"  {url} \\\n"
            '  --header "Authorization: Bearer $INVANA_TOKEN"'
        )
        return McpServerInfo(
            url=url,
            transport=TRANSPORT,
            protocol_version=PROTOCOL_VERSIONS[0],
            connect_command=command,
            agents_served=sum(1 for r in rows if r.kind == "agent" and r.served),
            functions_served=sum(1 for r in rows if r.kind == "function" and r.served),
            calls_today=await self.calls_qs.count(session, graph_id=graph.id, since=midnight),
        )

    async def calls(self, session: AsyncSession, *, graph: Graph, limit: int) -> tuple[list[McpCallRead], int]:
        """The newest calls, and how many there are in all."""
        runs = await self.calls_qs.recent(session, graph_id=graph.id, limit=limit)
        names = await self.access_qs.usernames(session, ids=[r.author_id for r in runs if r.author_id])
        items = []
        for r in runs:
            mcp = (r.params or {}).get("mcp") or {}
            items.append(
                McpCallRead(
                    run_id=r.id,
                    number=r.number,
                    at=r.queued_at,
                    caller=names.get(r.author_id or "", r.author_id or "—"),
                    client=mcp.get("client") or UNKNOWN_CLIENT,
                    token=mcp.get("token"),
                    tool=mcp.get("tool") or "",
                    status=r.status,
                    result=mcp.get("result"),
                )
            )
        return items, await self.calls_qs.count(session, graph_id=graph.id)

    # ── the protocol ─────────────────────────────────────────────────────────

    async def handle(
        self,
        session: AsyncSession,
        *,
        graph: Graph,
        caller: User,
        credential: Credential,
        message: Any,
        session_id: str | None,
    ) -> Reply:
        """Answer one JSON-RPC message; a ``tools/call`` that opens a run returns its id instead."""
        if not isinstance(message, dict) or message.get("jsonrpc") != "2.0" or "method" not in message:
            return Reply(status=400, body=_error(None, INVALID_REQUEST, "One JSON-RPC 2.0 request per POST."))
        method = str(message["method"])
        msg_id = message.get("id")
        params = message.get("params") or {}
        if "id" not in message:
            # A notification (`notifications/initialized`, a cancel) wants no answer.
            return Reply(status=202)
        if method == "initialize":
            return self._initialize(graph, msg_id, params)
        if method == "ping":
            return Reply(body=_ok(msg_id, {}))
        if method == "tools/list":
            tools = [self._tool(c) for c in await self._served_candidates(session, graph=graph)]
            return Reply(body=_ok(msg_id, {"tools": tools}))
        if method == "tools/call":
            return await self._call(
                session,
                graph=graph,
                caller=caller,
                credential=credential,
                msg_id=msg_id,
                params=params,
                session_id=session_id,
            )
        return Reply(body=_error(msg_id, METHOD_NOT_FOUND, f"This server answers no {method!r}."))

    def _initialize(self, graph: Graph, msg_id: Any, params: dict) -> Reply:
        asked = str(params.get("protocolVersion") or "")
        version = asked if asked in PROTOCOL_VERSIONS else PROTOCOL_VERSIONS[0]
        client = str((params.get("clientInfo") or {}).get("name") or "")
        result = {
            "protocolVersion": version,
            "capabilities": {"tools": {"listChanged": False}},
            "serverInfo": {
                "name": f"invana-{graph.slug}",
                "title": f"Invana · {graph.name}",
                "version": engine_version(),
            },
            "instructions": (
                f"The {graph.name} Graph. Validate records and push them as a draft dataset version — a person "
                "publishes it — or ask one of its agents. Every call is a run, recorded in its ledger."
            ),
        }
        return Reply(body=_ok(msg_id, result), headers={SESSION_HEADER: client_session_id(client)})

    async def _served_candidates(self, session: AsyncSession, *, graph: Graph) -> list[Candidate]:
        on = {(r.kind, r.ref) for r in await self.served_qs.for_graph(session, graph_id=graph.id) if r.served}
        return [c for c in await self.candidates(session, graph=graph) if (c.kind, c.ref) in on]

    @staticmethod
    def _tool(c: Candidate) -> dict:
        if c.kind == "agent":
            return {
                "name": c.tool,
                "title": f"Ask {c.name}",
                "description": f"Ask {c.name}: {c.does}. Runs as you, within your token.",
                "inputSchema": _ASK_SCHEMA,
                "annotations": {"readOnlyHint": False, "openWorldHint": False},
            }
        fn = SERVABLE[c.ref]
        read_only = CATALOGUE[c.ref].side_effect.value == "read"
        return {
            "name": c.tool,
            "title": fn.title,
            "description": f"{fn.does[0].upper()}{fn.does[1:]}. The function {c.ref}.",
            "inputSchema": fn.input_schema,
            "annotations": {"readOnlyHint": read_only, "openWorldHint": False},
        }

    @staticmethod
    def action_of(c: Candidate, args: dict) -> tuple[str, str]:
        """The ``(action, resource)`` one call of ``c`` is, as a token's inline policy reads it."""
        if c.kind == "agent":
            return "agent.ask", f"agent/{c.name}"
        dataset = str(args.get("dataset") or "").strip()
        return c.ref, f"dataset/{dataset}" if "/" in dataset else "dataset/*"

    async def _call(
        self,
        session: AsyncSession,
        *,
        graph: Graph,
        caller: User,
        credential: Credential,
        msg_id: Any,
        params: dict,
        session_id: str | None,
    ) -> Reply:
        name = str(params.get("name") or "")
        args = params.get("arguments") or {}
        if not isinstance(args, dict):
            return Reply(body=_error(msg_id, INVALID_PARAMS, "arguments is an object."))
        found = next((c for c in await self._served_candidates(session, graph=graph) if c.tool == name), None)
        if found is None:
            return Reply(body=_error(msg_id, INVALID_PARAMS, f"{name!r} is not a tool this Graph serves."))
        refusal = await self._narrowed(session, graph=graph, caller=caller, credential=credential, c=found, args=args)
        if refusal is not None:
            return Reply(body=_ok(msg_id, _tool_result(refusal, is_error=True)))
        mcp = {
            "tool": found.tool,
            "token_id": credential.token_id,
            "token": credential.token_name,
            "client": client_of(session_id),
        }
        if found.kind == "agent":
            question = str(args.get("question") or "").strip()
            if not question:
                return Reply(body=_error(msg_id, INVALID_PARAMS, "question is required."))
            assert found.agent is not None
            run = await services.open_mcp_agent_run(
                session, graph=graph, agent=found.agent, question=question, caller_id=caller.id, mcp=mcp
            )
        else:
            run = await services.open_mcp_function_run(
                session,
                graph=graph,
                function=found.ref,
                label=SERVABLE[found.ref].title,
                args=args,
                caller_id=caller.id,
                mcp=mcp,
            )
        return Reply(run_id=run.id)

    async def _narrowed(
        self,
        session: AsyncSession,
        *,
        graph: Graph,
        caller: User,
        credential: Credential,
        c: Candidate,
        args: dict,
    ) -> str | None:
        """The refusal for a narrowed token whose inline policy does not allow this call; records it."""
        if credential.narrowing is None:
            return None
        policy, raw = credential.narrowing
        try:
            statements: list[Statement] = parse_statements(raw)
        except StatementError:
            statements = []
        action, resource = self.action_of(c, args)
        if allows(statements, action=action, resource=resource) is not None:
            return None
        await emit_event(
            session,
            action=actions.TOKEN_REFUSED,
            target_kind=actions.TARGET_TOKEN,
            target_id=credential.token_id,
            graph_id=graph.id,
            actor_id=caller.id,
            details={"reason": "narrowed", "tool": c.tool, "action": action, "resource": resource, "policy": policy},
        )
        return (
            f"Token {credential.token_name!r} is narrowed by {policy!r}; it allows "
            f"{summary(statements) or 'nothing'}, not {action} on {resource}."
        )

    async def finish(self, session: AsyncSession, *, run_id: str, message: dict) -> Reply:
        """Read a settled call's run back as the tool's result, and store its one-line outcome."""
        run = await self.runs_qs.get(session, run_id)
        assert run is not None
        nodes = await self.runs_qs.nodes_of(session, run_id=run_id)
        failed = run.status != RunStatus.succeeded.value
        if run.agent_id:
            text, structured, line = self._agent_result(run)
        else:
            text, structured, line = self._function_result(run, nodes)
        mcp = dict((run.params or {}).get("mcp") or {})
        mcp["result"] = line
        run.params = {**(run.params or {}), "mcp": mcp}
        await session.flush()
        return Reply(body=_ok(message.get("id"), _tool_result(text, structured=structured, is_error=failed)))

    @staticmethod
    def _failure(run: TaskRun) -> str:
        error = run.error or {}
        return str(error.get("message") or error.get("short") or f"The run {run.status}.")

    def _function_result(self, run: TaskRun, nodes: list[TaskRun]) -> tuple[str, dict, str]:
        step = nodes[-1] if nodes else None
        number = f"run #{run.number}" if run.number else f"run {run.id}"
        if run.status != RunStatus.succeeded.value or step is None:
            failure = self._failure(step) if step is not None and step.error else self._failure(run)
            return f"Refused — {failure} ({number})", {"run": run.id, "error": failure}, f"failed · {failure}"[:255]
        output = dict(step.output or {})
        return (
            f"{step.detail} ({number})\n{json.dumps(output, ensure_ascii=False)}",
            {**output, "run": run.id},
            step.detail,
        )

    def _agent_result(self, run: TaskRun) -> tuple[str, dict, str]:
        summary_text = str((run.result or {}).get("summary") or "")
        exit_reason = run.exit_reason or run.status
        structured = {"run": run.id, "number": run.number, "outcome": run.outcome, "summary": summary_text}
        if run.status != RunStatus.succeeded.value:
            failure = self._failure(run)
            return f"{exit_reason} — {failure}", {**structured, "error": failure}, f"{exit_reason} · {failure}"[:255]
        text = summary_text or f"The run ended {exit_reason}."
        line = f"{exit_reason} · {summary_text}" if summary_text else exit_reason
        return text, structured, line[:255]
