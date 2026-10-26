"""What the Connections, This Graph's server page reads, and what a Served switch sends."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel

from invana.core.lists import Filter, ListSpec, Page


class McpServerInfo(BaseModel):
    """The endpoint card, the Claude Code line and the head's counts."""

    url: str
    transport: str
    protocol_version: str
    #: The ``claude mcp add`` line for this Graph, ready to paste.
    connect_command: str
    agents_served: int
    functions_served: int
    #: Runs triggered over MCP since 00:00 UTC.
    calls_today: int


class ServedRead(BaseModel):
    """One candidate the server may serve, and whether it does."""

    kind: str
    #: The agent's id, or the function's key.
    ref: str
    name: str
    tool: str
    does: str
    served: bool
    #: An agent's status; ``None`` for a function.
    status: str | None = None
    changed_at: datetime | None = None


class ServedUpdate(BaseModel):
    served: bool


class McpCallRead(BaseModel):
    """One call over this Graph's MCP server — a run."""

    run_id: str
    number: int | None
    at: datetime
    caller: str
    client: str
    token: str | None
    tool: str
    status: str
    #: The one-line outcome the engine stored when the run settled.
    result: str | None


SERVED_LIST = ListSpec(filters={"kind": Filter(values=("agent", "function"))}, sorts=("kind",))
CALLS_LIST = ListSpec(filters={}, sorts=("-at",))


class ServedPage(Page[ServedRead]):
    pass


class McpCallPage(Page[McpCallRead]):
    pass
