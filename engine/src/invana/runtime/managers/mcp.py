"""MCP servers — adding one, refreshing its frozen tools, and loading them all at start-up.

docs/for-developers/modules/platform/features/mcp-plugins.md. An install
Admin adds a server by name and URL; the engine lists its tools over
Streamable HTTP and stores them in ``mcp_servers``, frozen. Nothing reaches a
plan until a process starts and :meth:`McpManager.load` adds every stored
server to its registry as the plugin ``invana.mcp.<name>`` — so an add or a
refresh answers ``restart_required``, and the API and every worker serve the
same revision once restarted. Enabling the plugin is the ordinary tool-plugin
switch (:class:`~invana.runtime.managers.plugins.PluginManager`)::

    mcp = McpManager()
    await mcp.load(session)                                     # at start-up, before the runtime
    await mcp.add(session, name="files", url="http://…/mcp", actor=admin)
    await mcp.refresh(session, name="files", actor=admin)       # a new revision
    await mcp.get(session, "files")                             # McpServerRead

A bearer token for a server is read from ``INVANA_SECRET_MCP_<NAME>`` in the
process that makes the call — this one for add and refresh, the worker for a
step. An add that cannot list the tools stores nothing.
"""

from __future__ import annotations

import importlib.util
import os
from datetime import UTC, datetime

from sqlalchemy.ext.asyncio import AsyncSession

from invana.core.auth.models import User
from invana.core.errors import ConflictError, NotFoundError, PermissionDeniedError, ValidationError
from invana.plugins import install_mcp, load_plugins
from invana.plugins.mcp import client
from invana.plugins.mcp import plugin as mcp_plugin
from invana.plugins.registry import extra_installed
from invana.runtime import catalogue
from invana.runtime.models import McpServer
from invana.runtime.querysets.plugins import McpServerQuerySet
from invana.runtime.schemas import McpServerRead, McpToolRead


def mcp_installed() -> bool:
    """Whether the ``mcp`` extra — the SDK every MCP plugin calls through — is installed."""
    return extra_installed(mcp_plugin.EXTRA) and importlib.util.find_spec("mcp") is not None


def loaded_revision(name: str) -> int | None:
    """The revision of ``invana.mcp.<name>`` this process loaded, or None."""
    plugin = load_plugins().plugins.get(mcp_plugin.plugin_name(name))
    return int(plugin.manifest.version.split(".", 1)[0]) if plugin else None


def _token(name: str) -> str | None:
    return os.environ.get(f"INVANA_SECRET_{mcp_plugin.secret_name(name).upper()}") or None


class McpManager:
    """Stateless. The session is the first argument of every method."""

    servers_qs = McpServerQuerySet()

    async def stored(self, session: AsyncSession) -> list[McpServer]:
        return await self.servers_qs.all(session)

    async def load(self, session: AsyncSession) -> int:
        """Add every stored server to this process's registry; the number loaded.

        Called once by each front-end at start-up, before a runtime is built.
        Without the ``mcp`` extra nothing loads, and the listing says so.
        """
        rows = await self.servers_qs.all(session) if mcp_installed() else []
        install_mcp(
            tuple(mcp_plugin.to_plugin(name=r.name, url=r.url, revision=r.revision, tools=r.tools) for r in rows)
        )
        catalogue.sync()
        return len(rows)

    async def get(self, session: AsyncSession, name: str) -> McpServerRead:
        row = await self.servers_qs.get(session, name)
        if row is None:
            raise NotFoundError(f"No MCP server named {name}.")
        return self._read(row)

    async def add(self, session: AsyncSession, *, name: str, url: str, actor: User) -> McpServerRead:
        """Connect to ``url``, freeze its tools as revision 1 of ``invana.mcp.<name>``. Install Admin only.

        403 for anyone else; 409 when the extra is missing or the name is taken;
        422 for a name that is not ``[a-z][a-z0-9_]{0,31}``, a URL that is not
        http(s), or a server whose tools cannot be listed.
        """
        self._check(actor)
        if not mcp_plugin.SERVER_NAME.match(name):
            raise ValidationError(f"{name!r} is not an MCP server name: lower case, digits and _, up to 32.")
        if not url.startswith(("http://", "https://")):
            raise ValidationError(f"{url!r} is not an http(s) URL.")
        if await self.servers_qs.get(session, name) is not None:
            raise ConflictError(f"An MCP server named {name} is already added; refresh it instead.")
        server, listed = await self._list(name, url)
        tools, skipped = mcp_plugin.freeze(listed)
        row = McpServer(
            name=name,
            url=url,
            revision=1,
            tools=tools,
            skipped=skipped,
            server=server,
            frozen_at=datetime.now(UTC),
            added_by_id=actor.id,
        )
        return self._read(await self.servers_qs.add(session, row))

    async def refresh(self, session: AsyncSession, *, name: str, actor: User) -> McpServerRead:
        """List the server's tools again as the next revision. Install Admin only; 404 unknown, 422 unreachable."""
        self._check(actor)
        row = await self.servers_qs.get(session, name)
        if row is None:
            raise NotFoundError(f"No MCP server named {name}.")
        server, listed = await self._list(name, row.url)
        row.tools, row.skipped = mcp_plugin.freeze(listed, previous=row.tools)
        row.server, row.revision = server, row.revision + 1
        row.frozen_at, row.added_by_id = datetime.now(UTC), actor.id
        await session.flush()
        return self._read(row)

    @staticmethod
    def _check(actor: User) -> None:
        if not actor.is_superuser:
            raise PermissionDeniedError("Only an install Admin adds or refreshes an MCP server.")
        if not mcp_installed():
            raise ConflictError("MCP plugins need the mcp extra: pip install 'invana-engine[mcp]'.")

    @staticmethod
    async def _list(name: str, url: str) -> tuple[dict, list[dict]]:
        try:
            return await client.list_tools(url, _token(name))
        except client.McpError as exc:
            hint = ""
            if isinstance(exc, client.McpUnauthorized):
                hint = f" Set INVANA_SECRET_{mcp_plugin.secret_name(name).upper()} to its bearer token."
            raise ValidationError(f"{exc}{hint}") from exc

    @staticmethod
    def _read(row: McpServer) -> McpServerRead:
        loaded = loaded_revision(row.name)
        return McpServerRead(
            name=row.name,
            plugin=mcp_plugin.plugin_name(row.name),
            url=row.url,
            revision=row.revision,
            loaded_revision=loaded,
            restart_required=loaded != row.revision,
            tools=[
                McpToolRead(
                    key=mcp_plugin.task_key(row.name, t["name"]),
                    version=t["version"],
                    side_effect=mcp_plugin.side_effect(t).value,
                    summary=mcp_plugin.summary(t),
                )
                for t in row.tools
            ],
            skipped=list(row.skipped or ()),
            server=dict(row.server or {}),
            frozen_at=row.frozen_at,
        )
