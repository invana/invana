"""Plugins as an install sees them — what is loaded, which tool plugins are enabled, and switching them.

docs/for-developers/modules/platform/features/tool-plugins.md. The registry
(:func:`invana.plugins.load_plugins`) is what this process *can* run and never
changes; this manager answers what it *may* run. Core and simulator plugins
are always on; a tool plugin is on only while an install Admin has enabled it,
and the switch takes effect for the next step dispatched — no restart.

It is also the registry as a person reads it: every plugin in load order —
core, simulator, then tool — followed by the tool plugins on disk whose extra
is not installed, listed ``installed = false`` so the reader learns what would
install them::

    plugins = PluginManager()
    await plugins.list(session)                                 # [PluginSummary, …]
    await plugins.show(session, "invana.tools.web")             # PluginDetail
    await plugins.task_type(session, "execute_graph_query@1.0.0")  # TaskTypeRead, with runs_30d
    await plugins.is_enabled(session, "invana.tools.web")      # False until enabled
    await plugins.switch(session, name="invana.tools.web", enabled=True, actor=admin)
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

from sqlalchemy.ext.asyncio import AsyncSession

from invana.core.auth.models import User
from invana.core.errors import ConflictError, NotFoundError, PermissionDeniedError
from invana.plugins import load_plugins
from invana.plugins.registry import LoadedPlugin
from invana.plugins.sdk.manifest import PluginManifest, TaskManifest
from invana.runtime.models import PluginState
from invana.runtime.querysets.plugins import PluginStateQuerySet, TaskTypeUsageQuerySet
from invana.runtime.schemas import (
    PluginDetail,
    PluginFlowRead,
    PluginSkillRead,
    PluginSummary,
    TaskArgRead,
    TaskManifestRead,
    TaskTypeRead,
)

#: The kinds an Admin switches; every other kind is always on.
SWITCHABLE = frozenset({"tool"})

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


def _base(manifest: PluginManifest, *, installed: bool, enabled: bool) -> dict:
    return {
        "name": manifest.name,
        "kind": manifest.kind,
        "version": manifest.version,
        "title": manifest.title,
        "extra": manifest.extra,
        "installed": installed,
        "enabled": enabled,
        "switchable": manifest.kind in SWITCHABLE,
    }


class PluginManager:
    """Stateless. The session is the first argument of every method."""

    states_qs = PluginStateQuerySet()
    usage_qs = TaskTypeUsageQuerySet()

    async def enabled_names(self, session: AsyncSession) -> frozenset[str]:
        """Every plugin a step may run from now: the always-on kinds plus the enabled tool plugins."""
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
        """Every loaded plugin in registry order, then every tool plugin whose extra is missing."""
        registry = load_plugins()
        enabled = await self.enabled_names(session)
        out = [self._summary(p.manifest, p, enabled=p.manifest.name in enabled) for p in registry.plugins.values()]
        out += [self._summary(m, None, enabled=False) for m in registry.missing.values()]
        return out

    async def show(self, session: AsyncSession, name: str) -> PluginDetail:
        """One plugin with each task manifest, flow and skill it declares. 404 when no plugin has the name."""
        registry = load_plugins()
        plugin = registry.plugins.get(name)
        manifest = plugin.manifest if plugin else registry.missing.get(name)
        if manifest is None:
            raise NotFoundError(f"No plugin named {name}.")
        enabled = plugin is not None and await self.is_enabled(session, name)
        return PluginDetail(
            **_base(manifest, installed=plugin is not None, enabled=enabled),
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
        if plugin is None:
            return self._summary(registry.missing[name], None, enabled=False)
        return self._summary(plugin.manifest, plugin, enabled=enabled)

    async def set_enabled(self, session: AsyncSession, *, name: str, enabled: bool, actor: User) -> PluginState:
        """Enable or disable a tool plugin. Install Admin only.

        404 for a name no plugin carries; 409 for an always-on kind, and for
        enabling a tool plugin whose extra is not installed.
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
        if plugin is None:
            raise NotFoundError(f"No plugin named {name}.")
        if plugin.manifest.kind not in SWITCHABLE:
            raise ConflictError(f"{name} is a {plugin.manifest.kind} plugin and is always on.")
        return await self.states_qs.put(session, name=name, enabled=enabled, actor_id=actor.id)

    @staticmethod
    def _summary(manifest: PluginManifest, plugin: LoadedPlugin | None, *, enabled: bool) -> PluginSummary:
        return PluginSummary(
            **_base(manifest, installed=plugin is not None, enabled=enabled),
            task_types=len(plugin.tasks) if plugin else 0,
            skills=len(plugin.skills) if plugin else 0,
            flows=len(plugin.flows) if plugin else 0,
        )
