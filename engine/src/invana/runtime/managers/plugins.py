"""Plugins as an install sees them — what is loaded, which tool plugins are enabled, and switching them.

docs/for-developers/modules/platform/features/tool-plugins.md. The registry
(:func:`invana.plugins.load_plugins`) is what this process *can* run and never
changes; this manager answers what it *may* run. Core and simulator plugins
are always on; a tool plugin is on only while an install Admin has enabled it,
and the switch takes effect for the next step dispatched — no restart.

MCP plugins (docs/for-developers/modules/platform/features/mcp-plugins.md)
switch the same way. One stored in ``mcp_servers`` at a revision this process
did not load is listed ``restart_required``; one it did not load at all is
also ``installed = false``, and may still be enabled — the switch is a gate.

It is also the registry as a person reads it: every plugin in load order —
core, simulator, tool, then MCP — followed by the tool plugins on disk whose
extra is not installed and the MCP servers this process has not loaded, listed
``installed = false`` so the reader learns what would install them::

    plugins = PluginManager()
    await plugins.list(session)                                 # [PluginSummary, …]
    await plugins.page(session, params=params)                  # one page of the list, and its counts
    await plugins.show(session, "invana.tools.web")             # PluginDetail
    await plugins.task_type(session, "graph.read.query@1.0.0")  # TaskTypeRead, with runs_30d
    await plugins.is_enabled(session, "invana.tools.web")      # False until enabled
    await plugins.switch(session, name="invana.tools.web", enabled=True, actor=admin)
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

from sqlalchemy.ext.asyncio import AsyncSession

from invana.core.auth.models import User
from invana.core.errors import ConflictError, NotFoundError, PermissionDeniedError
from invana.core.lists import ListParams, PageInfo, page_of_rows
from invana.plugins import load_plugins
from invana.plugins.mcp import plugin as mcp_plugin
from invana.plugins.registry import LoadedPlugin
from invana.plugins.sdk.manifest import PluginManifest, TaskManifest
from invana.runtime.models import McpServer, PluginState
from invana.runtime.querysets.plugins import McpServerQuerySet, PluginStateQuerySet, TaskTypeUsageQuerySet
from invana.runtime.schemas import (
    PluginDetail,
    PluginFlowRead,
    PluginSkillRead,
    PluginSummary,
    TaskArgRead,
    TaskManifestRead,
    TaskTypeRead,
)

#: The kinds an Admin switches — and whose steps run where tool steps run; every other kind is always on.
SWITCHABLE = frozenset({"tool", "mcp"})

#: The window ``runs_30d`` counts over.
USAGE_WINDOW = timedelta(days=30)


def _manifest_fields(task: TaskManifest) -> dict:
    return {
        "key": task.key,
        "version": task.version,
        "summary": task.summary,
        "bound": task.bound.value,
        "side_effect": task.side_effect.value,
        "args": {
            name: TaskArgRead(type=arg.type.value, required=arg.required, default=arg.default)
            for name, arg in task.args.items()
        },
        "outputs": {name: type_.value for name, type_ in task.outputs.items()},
        "requires": list(task.requires),
        "resources": [r.value for r in task.resources],
        "timeout_s": task.timeout_s,
        "retries": task.retries,
    }


def _stored_manifest(row: McpServer) -> PluginManifest:
    """The manifest of an MCP server this process has not loaded, read from its row."""
    return PluginManifest(
        name=mcp_plugin.plugin_name(row.name),
        version=f"{row.revision}.0.0",
        kind="mcp",
        extra=mcp_plugin.EXTRA,
        secrets=(mcp_plugin.secret_name(row.name),),
        title=row.name,
    )


def _base(manifest: PluginManifest, *, installed: bool, enabled: bool, restart: bool = False) -> dict:
    return {
        "name": manifest.name,
        "kind": manifest.kind,
        "version": manifest.version,
        "title": manifest.title,
        "extra": manifest.extra,
        "installed": installed,
        "enabled": enabled,
        "switchable": manifest.kind in SWITCHABLE,
        "restart_required": restart,
    }


class PluginManager:
    """Stateless. The session is the first argument of every method."""

    states_qs = PluginStateQuerySet()
    usage_qs = TaskTypeUsageQuerySet()
    mcp_qs = McpServerQuerySet()

    async def _mcp_rows(self, session: AsyncSession) -> dict[str, McpServer]:
        """Every stored MCP server, by its plugin's name."""
        return {mcp_plugin.plugin_name(r.name): r for r in await self.mcp_qs.all(session)}

    @staticmethod
    def _restart(plugin: LoadedPlugin | None, row: McpServer | None) -> bool:
        return row is not None and (plugin is None or plugin.manifest.version != f"{row.revision}.0.0")

    async def enabled_names(self, session: AsyncSession) -> frozenset[str]:
        """Every plugin a step may run from now: the always-on kinds plus the enabled tool and MCP plugins."""
        switched = await self.states_qs.enabled_names(session)
        return frozenset(
            name for name, p in load_plugins().plugins.items() if p.manifest.kind not in SWITCHABLE or name in switched
        )

    async def is_enabled(self, session: AsyncSession, name: str) -> bool:
        plugin = load_plugins().plugins.get(name)
        if plugin is None:
            return False
        if plugin.manifest.kind not in SWITCHABLE:
            return True
        row = await self.states_qs.get(session, name)
        return bool(row and row.enabled)

    async def list(self, session: AsyncSession) -> list[PluginSummary]:
        """Every loaded plugin in registry order, then every tool plugin whose extra is missing,
        then every stored MCP server this process has not loaded."""
        registry = load_plugins()
        enabled = await self.enabled_names(session)
        switched = await self.states_qs.enabled_names(session)
        rows = await self._mcp_rows(session)
        out = [
            self._summary(p.manifest, p, enabled=p.manifest.name in enabled, restart=self._restart(p, rows.get(name)))
            for name, p in registry.plugins.items()
        ]
        out += [self._summary(m, None, enabled=False) for m in registry.missing.values()]
        out += [
            self._summary(_stored_manifest(row), None, enabled=name in switched, restart=True)
            for name, row in rows.items()
            if name not in registry.plugins
        ]
        return out

    async def page(self, session: AsyncSession, *, params: ListParams) -> tuple[list[PluginSummary], PageInfo]:
        """One page of the Plugins list — the registry read by :meth:`list`, searched, filtered and sorted.

        The registry is in memory, so the rows are narrowed here and paged by
        :func:`page_of_rows` over the plugin's name, which is unique.
        """
        every = await self.list(session)
        rows = every
        if kinds := params.values("kind"):
            rows = [p for p in rows if p.kind in kinds]
        enabled = set(params.values("enabled"))
        if len(enabled) == 1:
            want = "true" in enabled
            rows = [p for p in rows if p.enabled is want]
        if params.q:
            q = params.q.lower()
            rows = [p for p in rows if q in p.name.lower() or q in p.title.lower()]
        return page_of_rows(
            rows, params, unfiltered_total=len(every), sorts={"name": lambda p: p.name}, id_of=lambda p: p.name
        )

    async def show(self, session: AsyncSession, name: str) -> PluginDetail:
        """One plugin with each task manifest, flow and skill it declares. 404 when no plugin has the name."""
        registry = load_plugins()
        plugin = registry.plugins.get(name)
        row = (await self._mcp_rows(session)).get(name)
        manifest = plugin.manifest if plugin else registry.missing.get(name)
        if manifest is None and row is not None:
            manifest = _stored_manifest(row)
        if manifest is None:
            raise NotFoundError(f"No plugin named {name}.")
        if plugin is not None:
            enabled = await self.is_enabled(session, name)
        else:
            state = await self.states_qs.get(session, name) if row is not None else None
            enabled = bool(state and state.enabled)
        return PluginDetail(
            **_base(manifest, installed=plugin is not None, enabled=enabled, restart=self._restart(plugin, row)),
            secrets=list(manifest.secrets),
            task_types=[TaskManifestRead(**_manifest_fields(t)) for t in (plugin.tasks if plugin else ())],
            flows=[
                PluginFlowRead(key=f.key, version=f.version, kind=f.kind, description=f.description)
                for f in (plugin.flows if plugin else ())
            ],
            skills=[
                PluginSkillRead(
                    slug=s.slug, name=s.name, version=s.version, when_to_use=s.when_to_use, description=s.description
                )
                for s in (plugin.skills if plugin else ())
            ],
        )

    async def task_type(self, session: AsyncSession, ref: str) -> TaskTypeRead:
        """One task type by ``key`` or ``key@version``, its plugin and how often it ran in 30 days.

        404 when no loaded plugin declares it.
        """
        registry = load_plugins()
        task = registry.task(ref)
        if task is None:
            raise NotFoundError(f"No task type {ref}.")
        plugin = registry.plugins[task.plugin].manifest
        runs = await self.usage_qs.runs_since(session, key=task.key, since=datetime.now(UTC) - USAGE_WINDOW)
        return TaskTypeRead(**_manifest_fields(task), plugin=f"{plugin.name}@{plugin.version}", runs_30d=runs)

    async def switch(self, session: AsyncSession, *, name: str, enabled: bool, actor: User) -> PluginSummary:
        """:meth:`set_enabled`, answered with the plugin's summary as it now stands."""
        await self.set_enabled(session, name=name, enabled=enabled, actor=actor)
        registry = load_plugins()
        plugin = registry.plugins.get(name)
        row = (await self._mcp_rows(session)).get(name)
        if plugin is None and row is not None:
            return self._summary(_stored_manifest(row), None, enabled=enabled, restart=True)
        if plugin is None:
            return self._summary(registry.missing[name], None, enabled=False)
        return self._summary(plugin.manifest, plugin, enabled=enabled, restart=self._restart(plugin, row))

    async def set_enabled(self, session: AsyncSession, *, name: str, enabled: bool, actor: User) -> PluginState:
        """Enable or disable a tool or MCP plugin. Install Admin only.

        404 for a name no plugin carries; 409 for an always-on kind, and for
        enabling a tool plugin whose extra is not installed. A stored MCP server
        this process has not loaded may be switched: the gate applies once loaded.
        """
        if not actor.is_superuser:
            raise PermissionDeniedError("Only an install Admin enables or disables a plugin.")
        registry = load_plugins()
        missing = registry.missing.get(name)
        if missing is not None:
            if enabled:
                raise ConflictError(f"{name} is not installed. Install it with: pip install 'invana[{missing.extra}]'.")
            return await self.states_qs.put(session, name=name, enabled=False, actor_id=actor.id)
        plugin = registry.plugins.get(name)
        if plugin is None and name in await self._mcp_rows(session):
            return await self.states_qs.put(session, name=name, enabled=enabled, actor_id=actor.id)
        if plugin is None:
            raise NotFoundError(f"No plugin named {name}.")
        if plugin.manifest.kind not in SWITCHABLE:
            raise ConflictError(f"{name} is a {plugin.manifest.kind} plugin and is always on.")
        return await self.states_qs.put(session, name=name, enabled=enabled, actor_id=actor.id)

    @staticmethod
    def _summary(
        manifest: PluginManifest, plugin: LoadedPlugin | None, *, enabled: bool, restart: bool = False
    ) -> PluginSummary:
        return PluginSummary(
            **_base(manifest, installed=plugin is not None, enabled=enabled, restart=restart),
            task_types=len(plugin.tasks) if plugin else 0,
            skills=len(plugin.skills) if plugin else 0,
            flows=len(plugin.flows) if plugin else 0,
        )
