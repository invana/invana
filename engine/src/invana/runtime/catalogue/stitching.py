"""Stitching — declaring a bundle's rules against a Graph, and running them.

`stitches.json` states the rules between a bundle's folders, and `invana models
check` resolves them against the files (load-data.md LD12). This is the other
half: the same manifest, declared against a Graph, so the rules exist once.

Nothing is inferred here (ST1). Each rule is resolved to two **published
versions** (ST40) and handed to `modeller.links.declare`, which is the same
function the route calls — one path into `model_links`, whoever walks it. Every
declaration lands **staged** (ST21); committing is its own action.

The second half is the rows themselves. A relationship stitch whose endpoints
are their own fact has no key pair to join: its edges arrive as records, one row
per edge, in `stitches/<EDGE_TYPE>.json` under the folder whose records ship them
— the same shape `edges/` uses:

    {"id": "ABOUT_TWEET_0066", "from": "TWEET_0066", "to": "ART_001",
     "properties": {"via": "quote"}}

The edge type is in neither model, because a cross-model edge belongs to the
stitch. So the **stitch is the check**: these rows are written only for a
declared, active link that names this source model and this edge type. Endpoints
resolve by id against the whole graph and one that resolves nowhere is rejected
naming both (LD7), never written as a dangle.

**This is a body, not an entry.** `apply_stitches` and `commit_stitches` are
declared in `graph_write.py`, which spends the bound; what they do lives here
(the-runtime-package.md § 4a).
"""

from __future__ import annotations

import json
from collections.abc import Awaitable, Callable
from dataclasses import dataclass, field
from pathlib import Path
from typing import TYPE_CHECKING, Any

from invana.apps.modeller import links as link_service
from invana.apps.modeller.links import LinkRefused
from invana.apps.modeller.solve import Solved, rule_of, solvable, solve_links, stamp, withdraw_link, written_query
from invana.apps.modeller.store import ModelStore
from invana.runtime.catalogue.bundle import Rule, read_manifest
from invana.runtime.querysets import TaskRunQuerySet

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession

    from invana.apps.modeller.models import GraphModel, GraphVersion, ModelLink
    from invana.graph.connectors.base.connector import BaseConnector


#: Where a folder keeps the rows of a stitch its records supply (LD19).
FOLDER = "stitches"
#: Why a committed stitch wrote nothing in this run (ST53).
REFUSED = "refused by this run's lens"


@dataclass
class Loaded:
    """One stitch's rows, written. ``rejected`` is an endpoint that resolved nowhere."""

    link_id: str
    edge_type: str
    written: int = 0
    rejected: int = 0
    #: Why nothing was read at all — a missing file is the ordinary case, not a failure.
    skipped: str = ""
    report: list[dict] = field(default_factory=list)


def rows_path(root: Path, edge_type: str) -> Path | None:
    """`<root>/stitches/<EDGE_TYPE>.json`, or the same file loose in the folder."""
    for candidate in (root / FOLDER / f"{edge_type}.json", root / f"{edge_type}.json"):
        if candidate.is_file():
            return candidate
    return None


def _label(name: str) -> str:
    if "`" in name:
        raise ValueError(f"Invalid edge type: {name!r}")
    return f"`{name}`"


def write_query(edge_type: str) -> str:
    """MERGE one row's edge between two nodes already in the graph."""
    return (
        "MATCH (a {id: $from_id}), (b {id: $to_id}) "
        f"MERGE (a)-[r:{_label(edge_type)}]->(b) SET r += $props, r += $prov "
        "RETURN 1 AS ok"
    )


def _provenance(link: ModelLink, *, model_id: str | None, record_id: str, file: str) -> dict[str, Any]:
    """Both marks at once (ST52): a record somebody loaded, and a stitch's edge.

    The loaded half names the **model** the rows conform to, like every other
    written element (BD17) — an edge shipped as data is a record, and a record
    belongs to a model.
    """
    return {
        **stamp(link),
        "_inv_model_id": model_id or "",
        "_inv_record_id": record_id,
        "_inv_file": file,
    }


async def load_stitch_rows(
    connector: BaseConnector,
    link: ModelLink,
    *,
    root: Path,
    model_id: str | None = None,
) -> Loaded:
    """Write the rows *root* ships for *link*. The connector is already open.

    A missing file is reported, not raised: a dataset may simply not carry the rows
    yet, and the import that does carry them writes them then.
    """
    result = Loaded(link_id=link.id, edge_type=link.edge_type or "")
    if not link.edge_type or not link.source_model_id:
        result.skipped = "not a model-sourced stitch"
        return result

    path = rows_path(Path(root), link.edge_type)
    if path is None:
        result.skipped = f"no {FOLDER}/{link.edge_type}.json in this dataset"
        return result

    try:
        records = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        result.skipped = f"{path.name} could not be read: {exc}"
        return result

    file = f"{FOLDER}/{path.name}"
    query = write_query(link.edge_type)
    for index, record in enumerate(records):
        source, target = record.get("from"), record.get("to")
        params = {
            "from_id": source,
            "to_id": target,
            "props": dict(record.get("properties") or {}),
            "prov": _provenance(link, model_id=model_id, record_id=str(record.get("id", "")), file=file),
        }
        response = await connector.execute(query, params)
        rows = getattr(response, "records", None) or getattr(response, "rows", None) or []
        if rows:
            result.written += 1
        else:
            result.rejected += 1
            result.report.append(
                {
                    "file": file,
                    "record_index": index,
                    "record_id": record.get("id"),
                    "field": None,
                    "rule": "unresolved_endpoint",
                    "message": (f"{link.edge_type}: neither this dataset nor the graph holds {source!r} → {target!r}."),
                }
            )
    return result


_runs_qs = TaskRunQuerySet()


class Unresolvable(Exception):
    """A rule that cannot be declared yet, in the words the reader can act on."""


@dataclass
class Side:
    """What a manifest's `<dataset>:` resolved to in this Graph."""

    dataset: str
    model: str
    model_id: str
    version_id: str
    version: str


@dataclass
class Outcome:
    """One rule, and what became of it."""

    rule: Rule
    #: `planned` · `declared` · `already` · `skipped`
    status: str
    detail: str = ""
    source: Side | None = None
    target: Side | None = None
    link_id: str | None = None

    @property
    def blocked(self) -> bool:
        """Skipped is the only outcome a pipeline should stop for (ST41)."""
        return self.status == "skipped"


@dataclass
class Applied:
    """Every rule's outcome. Declaring only — committing is its own run (`stitch-commit@1`)."""

    name: str
    outcomes: list[Outcome] = field(default_factory=list)
    dry_run: bool = False

    @property
    def declared(self) -> int:
        return sum(1 for o in self.outcomes if o.status in ("declared", "planned"))

    @property
    def already(self) -> int:
        return sum(1 for o in self.outcomes if o.status == "already")

    @property
    def skipped(self) -> int:
        return sum(1 for o in self.outcomes if o.blocked)

    @property
    def passed(self) -> bool:
        return not any(o.blocked for o in self.outcomes)


# ---------------------------------------------------------------------------
# Resolving a dataset to a published version (ST40)
# ---------------------------------------------------------------------------


def _artefact_identity(root: Path, dataset: str) -> tuple[str | None, str | None]:
    """The `package_id` and name the dataset's own `graph-model.json` carries."""
    path = root / dataset / "graph-model.json"
    if not path.is_file():
        return None, None
    try:
        artefact = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None, None
    return artefact.get("package_id"), artefact.get("name")


async def _model_for(
    session: AsyncSession,
    store: ModelStore,
    *,
    graph_id: str,
    root: Path,
    dataset: str,
) -> GraphModel:
    """Package first, then the local name (ST40).

    A folder declares its own model, so nothing else has to remember the binding
    (**LD23**). There is no third branch: the Dataset row that used to be one was
    reached only when a bundle shipped no `graph-model.json`, and it is not what
    `ModelLink.source_model_id` records.
    """
    package_id, name = _artefact_identity(root, dataset)
    models = await store.list_graph_models(session, graph_id)

    if package_id:
        by_package = next((m for m in models if m.package_id == package_id), None)
        if by_package is not None:
            return by_package
    if name:
        by_name = next((m for m in models if m.name.lower() == name.lower()), None)
        if by_name is not None:
            return by_name

    wanted = name or dataset
    known = ", ".join(m.name for m in models) or "none"
    raise Unresolvable(f"no model {wanted!r} in this Graph — models here: {known}")


async def _published_version(session: AsyncSession, store: ModelStore, model: GraphModel) -> GraphVersion:
    """The active version, or the newest published one. A draft cannot be stitched (ST8)."""
    active = await store.get_active_version(session, model.id)
    if active is not None:
        return active
    published = [v for v in await store.list_versions(session, model.id) if v.status != "draft"]
    if not published:
        raise Unresolvable(f"{model.name} has no published version — publish it in Studio first")
    version = await store.get_version(session, published[-1].id)
    if version is None:  # pragma: no cover — the row was listed a line ago
        raise Unresolvable(f"{model.name} has no published version — publish it in Studio first")
    return version


async def _side(
    session: AsyncSession,
    store: ModelStore,
    *,
    graph_id: str,
    root: Path,
    dataset: str,
    type_name: str,
    cache: dict[str, Side],
) -> Side:
    if dataset not in cache:
        model = await _model_for(session, store, graph_id=graph_id, root=root, dataset=dataset)
        version = await _published_version(session, store, model)
        cache[dataset] = Side(
            dataset=dataset, model=model.name, model_id=model.id, version_id=version.id, version=version.version
        )
    side = cache[dataset]
    version = await store.get_version(session, side.version_id)
    if version is None or not any(nt.name == type_name for nt in version.node_types):
        raise Unresolvable(f"{side.model} {side.version} has no node type {type_name!r}")
    return side


# ---------------------------------------------------------------------------
# Applying
# ---------------------------------------------------------------------------


def _same_pair(link, *, kind: str, source: Side, source_type: str, target: Side, target_type: str, edge: str | None):
    return (
        link.kind == kind
        and link.source_version_id == source.version_id
        and link.source_type == source_type
        and link.target_version_id == target.version_id
        and link.target_type == target_type
        and link.edge_type == edge
    )


async def apply_bundle(
    session: AsyncSession,
    store: ModelStore | None = None,
    *,
    graph_id: str,
    root: Path,
    dry_run: bool = False,
) -> Applied:
    """Declare every rule `<root>/stitches.json` states, staged (ST21).

    Committing is its own action, because committing writes edges (ST44) and this
    function never opens the graph database.

    A rule already declared is reported, never declared twice (ST41), and a rule
    that cannot be resolved is skipped with the reason rather than failing the run
    at the first one — a manifest is read as a whole.
    """
    store = store or ModelStore()
    root = Path(root).resolve()
    manifest = read_manifest(root)
    run = Applied(name=manifest.name, dry_run=dry_run)
    cache: dict[str, Side] = {}
    existing = await link_service.list_links(session, graph_id)

    for rule in manifest.rules:
        try:
            source = await _side(
                session,
                store,
                graph_id=graph_id,
                root=root,
                dataset=rule.source_dataset,
                type_name=rule.source_type,
                cache=cache,
            )
            target = await _side(
                session,
                store,
                graph_id=graph_id,
                root=root,
                dataset=rule.target_dataset,
                type_name=rule.target_type,
                cache=cache,
            )
        except Unresolvable as exc:
            run.outcomes.append(Outcome(rule=rule, status="skipped", detail=str(exc)))
            continue

        # Endpoints are rows, not a key pair (ST42) — the model that ships the file.
        # `_side` already refused a folder whose model this Graph does not have,
        # so there is nothing left to look up here.
        source_model_id: str | None = source.model_id if rule.rows else None

        already = next(
            (
                link
                for link in existing
                if _same_pair(
                    link,
                    kind=rule.kind,
                    source=source,
                    source_type=rule.source_type,
                    target=target,
                    target_type=rule.target_type,
                    edge=rule.edge_type,
                )
            ),
            None,
        )
        if already is not None:
            run.outcomes.append(
                Outcome(
                    rule=rule, status="already", detail=already.status, source=source, target=target, link_id=already.id
                )
            )
            continue

        if dry_run:
            run.outcomes.append(Outcome(rule=rule, status="planned", source=source, target=target))
            continue

        try:
            link = await link_service.declare(
                session,
                store,
                graph_id=graph_id,
                kind=rule.kind,
                source_version_id=source.version_id,
                source_type=rule.source_type,
                target_version_id=target.version_id,
                target_type=rule.target_type,
                # A source model supplies the endpoints or the keys do, never both (ST27).
                source_property=None if source_model_id else rule.source_property,
                target_property=None if source_model_id else rule.target_property,
                identity_match=rule.identity_match,
                edge_type=rule.edge_type,
                source_model_id=source_model_id,
                description=f"from the {manifest.name} bundle ({rule.id})",
            )
        except LinkRefused as exc:
            detail = ", ".join(f"{k}={v}" for k, v in exc.detail.items())
            run.outcomes.append(
                Outcome(rule=rule, status="skipped", detail=f"{exc.error} ({detail})", source=source, target=target)
            )
            continue

        existing.append(link)
        run.outcomes.append(Outcome(rule=rule, status="declared", source=source, target=target, link_id=link.id))

    return run


# ---------------------------------------------------------------------------
# Committing — the one path, whoever pressed it
# ---------------------------------------------------------------------------


@dataclass
class Committed:
    """A commit: the rows flipped, what the join wrote, and what the rows loaded."""

    links: list = field(default_factory=list)
    solved: list[Solved] = field(default_factory=list)
    loaded: list[Loaded] = field(default_factory=list)

    @property
    def written(self) -> int:
        return sum(s.written for s in self.solved) + sum(loaded.written for loaded in self.loaded)

    @property
    def rejected(self) -> int:
        return sum(loaded.rejected for loaded in self.loaded)


async def _records_root(session: AsyncSession, source_model_id: str) -> Path | None:
    """Where the records of *source_model_id* were last loaded from.

    A stitch whose endpoints are rows reads them out of the folder that shipped
    them (LD19), and the folder is a fact about a load rather than about the
    model — so it is read back from the load, not stored a second time
    (task-model-migration § 6.7).
    """
    root = await _runs_qs.latest_load_root(session, model_id=source_model_id)
    return Path(root) if root else None


async def commit_stitches(
    session: AsyncSession,
    *,
    graph_id: str,
    connector,
    admit: Callable[[ModelLink], Awaitable[bool]],
) -> Committed:
    """Flip the staged set to active and run every stitch in it (ST21, ST44, ST51).

    Two kinds of run, one action: a keyed rule joins its two keys, and a rule whose
    endpoints are rows loads them from the folder whose records ship them. The Stitches
    drawer and `invana stitches commit` both come through here, so a commit cannot
    mean two different things.

    ``admit`` is a run's lens on each stitch's two models (ST53). A stitch it
    refuses is still committed — the rule is the Graph's, not the run's — but
    this run writes none of its edges, and says so. It is **required**: only the
    `commit_stitches` step calls this, so there is no path that writes a
    stitch's edges without asking the lens first.
    """
    committed = await link_service.commit_staged(session, graph_id)
    if not committed:
        return Committed()

    run = Committed(links=committed)
    refused = {link.id for link in committed if not await admit(link)}
    for link in committed:
        if link.id in refused:
            run.solved.append(
                Solved(link_id=link.id, edge_type=link.edge_type or "", rule=rule_of(link), skipped=REFUSED)
            )
    await connector.connect()
    try:
        run.solved += await solve_links(
            connector, [link for link in committed if solvable(link) and link.id not in refused]
        )
        for link in committed:
            if not link.source_model_id or link.id in refused:
                continue
            root = await _records_root(session, link.source_model_id)
            if root is None:
                run.loaded.append(
                    Loaded(
                        link_id=link.id,
                        edge_type=link.edge_type or "",
                        skipped="nothing has loaded records into its source model yet",
                    )
                )
                continue
            run.loaded.append(await load_stitch_rows(connector, link, root=root, model_id=link.source_model_id))
    finally:
        await connector.disconnect()
    return run


async def withdraw_stitch(
    session: AsyncSession,
    *,
    graph_id: str,
    link: ModelLink,
    connector,
    admit: Callable[[str], Awaitable[bool]],
) -> int:
    """Delete the edges one active stitch wrote, then the rule itself (ST48 · ST55).

    ``admit`` is the run's lens on each of the stitch's two models, and it is
    asked **before** anything is deleted — a refusal ends the run with the rule
    and its edges both still there. The row goes last, so a database that fails
    halfway leaves a rule that still names its edges rather than edges that name
    nothing.
    """
    await admit(link.source_version_id)
    if link.target_version_id != link.source_version_id:
        await admit(link.target_version_id)
    await connector.connect()
    try:
        withdrawn = await withdraw_link(connector, link)
    finally:
        await connector.disconnect()
    await link_service.remove(session, graph_id, link.id)
    return withdrawn


# ── previewing a rule, under the run's lens ───────────────────────────────────

#: Reads one query under the run's lens and returns its first row. Raises what
#: the lens or the database raised — the body turns that into a refusal.
Read = Callable[[str, dict | None], Awaitable[dict]]


async def preview_rules(
    session: AsyncSession,
    *,
    graph_id: str,
    rules: list[dict],
    all_links: bool,
    read: Read,
    refused: Callable[[Exception], str | None],
) -> list[dict]:
    """Count what each rule resolves — and, for a declared active stitch, what it wrote.

    ``rules`` is the drawer's one undeclared rule; ``all_links`` is `invana
    stitches resolve`, every declared stitch. Both are **reads**, and both go
    through ``read`` — the entry's crossing, under the run's lens — so a rule
    naming a type or key the guardrails deny is refused with that reason rather
    than counted around it. ``refused`` says whether an exception is a refusal
    (its message) or a failure to raise.
    """
    if all_links:
        rules = [
            {
                "link_id": link.id,
                "kind": link.kind,
                "edge_type": link.edge_type,
                "source_model_id": link.source_model_id,
                "status": link.status,
                "solvable": solvable(link),
                "source_type": link.source_type,
                "source_property": link.source_property or "",
                "target_type": link.target_type,
                "target_property": link.target_property or "",
                "identity_match": link.identity_match,
            }
            for link in await link_service.list_links(session, graph_id)
        ]
    out: list[dict] = []
    for rule in rules:
        row: dict = {**rule, "preview": None, "written": None, "refused": None}
        if rule.get("solvable", True):
            query = link_service.stitch_preview_query(
                source_type=rule["source_type"],
                source_property=rule["source_property"],
                target_type=rule["target_type"],
                target_property=rule["target_property"],
                case_insensitive=rule.get("identity_match") == "case_insensitive",
            )
            try:
                counted = await read(query, None)
            except Exception as exc:
                reason = refused(exc)
                if reason is None:
                    raise
                row["refused"] = reason
                out.append(row)
                continue
            row["preview"] = link_service.read_preview(
                counted,
                source_type=rule["source_type"],
                source_property=rule["source_property"],
                target_type=rule["target_type"],
                target_property=rule["target_property"],
            ).model_dump(mode="json")
        if rule.get("link_id") and rule.get("status") == "active":
            try:
                row["written"] = int((await read(written_query(), {"stitch_id": rule["link_id"]})).get("written") or 0)
            except Exception as exc:
                reason = refused(exc)
                if reason is None:
                    raise
                row["refused"] = reason
        out.append(row)
    return out
