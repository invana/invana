"""Stitching — declared links between two published models, and the union they imply.

Two domain models meet only where somebody said they meet
(docs/for-developers/modules/connect-and-model/features/stitch-models.md). An **anchor**
says two types are the same entity; it links and never merges (ST2). A
**relationship link** declares a cross-model edge type between them.

Either way the link carries **a key on each side** (ST26) — ``source_property``
and ``target_property``, compared as ``identity_match`` says — because the two
models were authored apart and almost never spell the same fact the same way.
The pair means *same entity* on an anchor and *where the edge attaches* on a
relationship, and a relationship takes its endpoints from that pair **or** from a
source model, never both (ST27).

The **global model** is the read-time union of the published versions plus these
rows (ST3). Nothing here is stored: ``derive_global_model`` computes it on every
read, which is why there is no row to edit and nothing to keep in sync.
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

from pydantic import BaseModel
from sqlalchemy import select

from invana.apps.modeller.models import GraphModel, GraphVersion, ModelLink

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession

    from invana.apps.modeller.store import ModelStore


class LinkRefused(ValueError):
    """A link that cannot be declared, with the reason a person can act on."""

    def __init__(self, error: str, detail: dict[str, Any]) -> None:
        super().__init__(error)
        self.error = error
        self.detail = detail


# ---------------------------------------------------------------------------
# Declaring
# ---------------------------------------------------------------------------


async def _published_version(session: AsyncSession, store: ModelStore, version_id: str) -> GraphVersion:
    version = await store.get_version(session, version_id)
    if version is None:
        raise LinkRefused("version_not_found", {"version_id": version_id})
    if version.status == "draft":
        raise LinkRefused("version_is_draft", {"version_id": version_id, "version": version.version})
    return version


def _has_node_type(version: GraphVersion, name: str) -> bool:
    return any(nt.name == name for nt in version.node_types)


async def declare(
    session: AsyncSession,
    store: ModelStore,
    *,
    graph_id: str,
    kind: str,
    source_version_id: str,
    source_type: str,
    target_version_id: str,
    target_type: str,
    source_property: str | None = None,
    target_property: str | None = None,
    identity_match: str = "exact",
    edge_type: str | None = None,
    source_model_id: str | None = None,
    description: str = "",
    status: str = "staged",
) -> ModelLink:
    """Declare one link. Refuses anything it cannot state plainly.

    It lands **staged** (ST21): the row exists, so it survives a reload and
    anyone opening the Graph sees it, but ``derive_global_model`` unions active
    rows only — nothing a question can reach changes until a commit.
    """
    source = await _published_version(session, store, source_version_id)
    target = await _published_version(session, store, target_version_id)

    for version, type_name in ((source, source_type), (target, target_type)):
        if not _has_node_type(version, type_name):
            raise LinkRefused(
                "type_not_in_version",
                {"version_id": version.id, "version": version.version, "type": type_name},
            )

    if kind == "anchor":
        # Both keys, always. A single name assumed to hold on both sides is a rule
        # that only survives when the two models were authored together (ST26).
        if not source_property or not target_property:
            raise LinkRefused(
                "key_required_on_each_side",
                {"kind": kind, "source_property": source_property, "target_property": target_property},
            )
        if edge_type:
            raise LinkRefused("edge_type_on_anchor", {"edge_type": edge_type})
        if source_model_id:
            raise LinkRefused("source_model_on_anchor", {"source_model_id": source_model_id})
    elif kind == "relationship":
        if not edge_type:
            raise LinkRefused("edge_type_required", {"kind": kind})
        from_keys = bool(source_property and target_property)
        # Keys or a source model — one edge type with two sources of truth has no
        # rule for which wins (ST27).
        if from_keys and source_model_id:
            raise LinkRefused(
                "keys_and_source_model",
                {"edge_type": edge_type, "source_model_id": source_model_id},
            )
        if not from_keys and not source_model_id:
            raise LinkRefused(
                "endpoints_required",
                {"edge_type": edge_type},
            )
        if not from_keys and (source_property or target_property):
            raise LinkRefused(
                "key_required_on_each_side",
                {"kind": kind, "source_property": source_property, "target_property": target_property},
            )
    else:
        raise LinkRefused("unknown_link_kind", {"kind": kind})

    # Status is deliberately not part of this check: a pair is anchored once, and
    # staging a second rule for a pair that already has one is the same
    # disagreement whether or not the first was committed.
    existing = await list_links(session, graph_id)
    for link in existing:
        same_pair = (
            link.kind == kind
            and link.source_version_id == source_version_id
            and link.source_type == source_type
            and link.target_version_id == target_version_id
            and link.target_type == target_type
            and link.edge_type == edge_type
        )
        if same_pair:
            # Named, not just refused: the card that shows this states the rule
            # the existing stitch already carries, so the reader can change that
            # one rather than declaring a second that disagrees with it.
            raise LinkRefused(
                "link_already_declared",
                {
                    "link_id": link.id,
                    "kind": link.kind,
                    "source_type": link.source_type,
                    "target_type": link.target_type,
                    "source_property": link.source_property,
                    "target_property": link.target_property,
                    "identity_match": link.identity_match,
                    "edge_type": link.edge_type,
                },
            )

    link = ModelLink(
        graph_id=graph_id,
        kind=kind,
        source_version_id=source_version_id,
        source_type=source_type,
        target_version_id=target_version_id,
        target_type=target_type,
        source_property=source_property,
        target_property=target_property,
        identity_match=identity_match,
        edge_type=edge_type,
        source_model_id=source_model_id,
        description=description,
        status=status,
    )
    session.add(link)
    await session.flush()
    return link


async def list_links(session: AsyncSession, graph_id: str, *, status: str | None = None) -> list[ModelLink]:
    """Every link touching this Graph, newest last. ``status`` narrows to one set."""
    stmt = select(ModelLink).where(ModelLink.graph_id == graph_id)
    if status is not None:
        stmt = stmt.where(ModelLink.status == status)
    stmt = stmt.order_by(ModelLink.created_at)
    return list((await session.execute(stmt)).scalars().all())


async def get_link(session: AsyncSession, graph_id: str, link_id: str) -> ModelLink | None:
    stmt = select(ModelLink).where(ModelLink.graph_id == graph_id, ModelLink.id == link_id)
    return (await session.execute(stmt)).scalar_one_or_none()


async def commit_staged(session: AsyncSession, graph_id: str) -> list[ModelLink]:
    """Flip every staged stitch in the Graph to active, in one action (ST21).

    One action, not one per row: staging exists so a set of stitches can be
    reviewed together, and committing them one at a time would put the union in
    states nobody chose.
    """
    staged = await list_links(session, graph_id, status="staged")
    for link in staged:
        link.status = "active"
    await session.flush()
    return staged


async def discard_staged(session: AsyncSession, graph_id: str, link_id: str | None = None) -> list[ModelLink]:
    """Delete staged stitches — all of them, or one named.

    Discarding deletes rather than reverting: a staged stitch was never in the
    union, so there is no earlier state to put back.
    """
    staged = await list_links(session, graph_id, status="staged")
    doomed = [link for link in staged if link_id is None or link.id == link_id]
    for link in doomed:
        await session.delete(link)
    await session.flush()
    return doomed


async def remove(session: AsyncSession, graph_id: str, link_id: str) -> bool:
    link = await get_link(session, graph_id, link_id)
    if link is None:
        return False
    await session.delete(link)
    await session.flush()
    return True


# ---------------------------------------------------------------------------
# The global model — derived, never stored
# ---------------------------------------------------------------------------


class GlobalType(BaseModel):
    """One type in the union, and every model that holds a copy of it."""

    name: str
    models: list[str] = []
    anchored: bool = False


class GlobalModel(BaseModel):
    """The union of a Graph's published models plus its declared links."""

    node_types: list[GlobalType] = []
    edge_types: list[GlobalType] = []
    model_count: int = 0
    link_count: int = 0
    anchor_count: int = 0
    relationship_count: int = 0
    # Declared but not committed, so counted *beside* the union and never into
    # it — the same rule the physical mirror's label count follows (ST7).
    staged_count: int = 0
    # Set when two anchored types collapse into one entry — "Stock once, across 4".
    collapsed: list[str] = []
    # What the *physical* database actually holds, introspected — beside the
    # derived counts and never added into them (ST7). A label nobody modelled is
    # a fact about the database, not a member of the union.
    mirror_label_count: int = 0


async def derive_global_model(session: AsyncSession, store: ModelStore, *, graph_id: str) -> GlobalModel:
    """Compute the union on read. There is no row behind this (ST3)."""
    models = await store.list_graph_models(session, graph_id)
    authored = [m for m in models if m.origin != "introspected"]
    # **Active only** (ST21). A staged stitch is a declaration somebody has not
    # committed; unioning it would let an uncommitted rule change an answer,
    # which is the one thing staging exists to prevent.
    links = await list_links(session, graph_id, status="active")
    staged_count = len(await list_links(session, graph_id, status="staged"))

    # Anchored types share one entry: an anchor says they are the same entity, so
    # counting them twice would overstate the domain (C5). They still both exist —
    # nothing is merged (ST2); only the count is honest.
    canonical: dict[tuple[str, str], tuple[str, str]] = {}
    for link in (link for link in links if link.kind == "anchor"):
        source_key = (link.source_version_id, link.source_type)
        target_key = (link.target_version_id, link.target_type)
        canonical[source_key] = canonical.get(target_key, target_key)

    def resolve(key: tuple[str, str]) -> tuple[str, str]:
        seen: set[tuple[str, str]] = set()
        while key in canonical and key not in seen:
            seen.add(key)
            key = canonical[key]
        return key

    node_entries: dict[tuple[str, str], GlobalType] = {}
    edge_entries: dict[str, GlobalType] = {}
    collapsed: list[str] = []

    for model in authored:
        version = await _active_or_latest(session, store, model)
        if version is None:
            continue
        for nt in version.node_types:
            key = resolve((version.id, nt.name))
            entry = node_entries.get(key)
            if entry is None:
                entry = GlobalType(name=nt.name, models=[], anchored=key != (version.id, nt.name))
                node_entries[key] = entry
            if model.name not in entry.models:
                entry.models.append(model.name)
            if len(entry.models) > 1 and entry.name not in collapsed:
                entry.anchored = True
                collapsed.append(entry.name)
        for et in version.edge_types:
            entry = edge_entries.setdefault(et.name, GlobalType(name=et.name, models=[]))
            if model.name not in entry.models:
                entry.models.append(model.name)

    for link in (link for link in links if link.kind == "relationship" and link.edge_type):
        edge_entries.setdefault(link.edge_type, GlobalType(name=link.edge_type, models=[], anchored=False))

    return GlobalModel(
        node_types=sorted(node_entries.values(), key=lambda t: t.name),
        edge_types=sorted(edge_entries.values(), key=lambda t: t.name),
        model_count=len(authored),
        link_count=len(links),
        anchor_count=sum(1 for link in links if link.kind == "anchor"),
        relationship_count=sum(1 for link in links if link.kind == "relationship"),
        staged_count=staged_count,
        collapsed=sorted(collapsed),
        mirror_label_count=await _mirror_label_count(session, store, graph_id),
    )


async def _mirror_label_count(session: AsyncSession, store: ModelStore, graph_id: str) -> int:
    """How many labels the bound database actually carries.

    The introspected model is a mirror, not a member: it is regenerated from the
    live database and never hand-authored, so its count sits *beside* the union
    (ST7). Zero when nobody has introspected yet — which is honest, not missing.
    """
    mirror = await store.get_introspected_model(session, graph_id)
    if mirror is None:
        return 0
    version = await _active_or_latest(session, store, mirror)
    return len(version.node_types) if version else 0


async def _active_or_latest(session: AsyncSession, store: ModelStore, model: GraphModel) -> GraphVersion | None:
    version = await store.get_active_version(session, model.id)
    if version is not None:
        return version
    versions = await store.list_versions(session, model.id)
    published = [v for v in versions if v.status != "draft"]
    return await store.get_version(session, published[-1].id) if published else None


# ---------------------------------------------------------------------------
# Preview — how many resolve, before anything is declared
# ---------------------------------------------------------------------------


class StitchPreview(BaseModel):
    """What a join rule would actually match, counted before the stitch exists.

    The counts are of **distinct key values**, not of rows: a rule is right or
    wrong about the vocabulary on each side, and a value repeated a thousand
    times is still one thing the two models either agree about or do not.
    """

    source_total: int = 0
    target_total: int = 0
    resolved: int = 0
    unresolved_source: int = 0
    unresolved_target: int = 0
    # The first few source keys that match nothing — what "Show the N" opens.
    # A count tells you the rule is wrong; the values tell you *how*.
    unresolved_sample: list[str] = []
    # Whether there was anything to judge. A side with no rows carrying the key
    # cannot tell you a rule is wrong — it tells you the data has not arrived.
    # Models are authored before data lands, so that is the ordinary case, and
    # refusing the stitch there would refuse the ordinary order of work.
    countable: bool = True
    # Stated plainly when nothing matches: the rule is wrong, not the data.
    verdict: str = ""


#: How many unmatched keys the preview carries back. Enough to see the shape of
#: what is missing, few enough that the payload stays a preview.
SAMPLE_SIZE = 25


def stitch_preview_query(
    *,
    source_type: str,
    source_property: str,
    target_type: str,
    target_property: str,
    case_insensitive: bool = False,
) -> str:
    """openCypher that counts what the rule resolves, without writing anything.

    A key on each side (ST26), so the two property names are read separately —
    the commonest stitch is exactly the one where they differ.
    """

    def key(var: str, prop: str) -> str:
        raw = f"{var}.`{prop}`"
        return f"toLower(toString({raw}))" if case_insensitive else raw

    return (
        f"MATCH (x:`{source_type}`) WHERE x.`{source_property}` IS NOT NULL "
        f"WITH collect(DISTINCT {key('x', source_property)}) AS source_keys "
        f"MATCH (y:`{target_type}`) WHERE y.`{target_property}` IS NOT NULL "
        f"WITH source_keys, collect(DISTINCT {key('y', target_property)}) AS target_keys "
        f"RETURN size(source_keys) AS source_total, size(target_keys) AS target_total, "
        f"size([k IN source_keys WHERE k IN target_keys]) AS resolved, "
        f"[k IN source_keys WHERE NOT k IN target_keys][0..{SAMPLE_SIZE}] AS unresolved_sample"
    )


def read_preview(
    row: dict[str, Any],
    *,
    source_type: str = "",
    source_property: str = "",
    target_type: str = "",
    target_property: str = "",
) -> StitchPreview:
    """Turn one result row into the preview the panel shows.

    The verdict names both keys because that is the sentence a person has to
    judge: it is ``Sector.gics_code`` and ``Theme.theme_code`` that have nothing
    in common, and saying so is the difference between *your rule is wrong* and
    *something went wrong*.
    """
    source_total = int(row.get("source_total") or 0)
    target_total = int(row.get("target_total") or 0)
    resolved = int(row.get("resolved") or 0)
    sample = [str(v) for v in (row.get("unresolved_sample") or [])]
    unresolved_source = max(0, source_total - resolved)
    left = f"{source_type}.{source_property}" if source_type and source_property else "the source key"
    right = f"{target_type}.{target_property}" if target_type and target_property else "the target key"
    countable = source_total > 0 and target_total > 0
    if not countable:
        empty = left if source_total == 0 else right
        verdict = (
            f"Nothing to count yet — no records carry a {empty}. "
            "The rule stands until data arrives to judge it against."
        )
    elif resolved == 0:
        verdict = f"Nothing resolves under this rule — no {left} equals any {right}. The rule is wrong, not the data."
    elif unresolved_source == 0:
        verdict = f"Every {left} resolves against a {right}."
    else:
        noun = "row carries" if unresolved_source == 1 else "rows carry"
        verdict = (
            f"{unresolved_source:,} {source_type or 'source'} {noun} a {source_property or 'key'} "
            f"that no {right} equals. Counted before the stitch exists, never after."
        )
    return StitchPreview(
        source_total=source_total,
        target_total=target_total,
        resolved=resolved,
        unresolved_source=unresolved_source,
        unresolved_target=max(0, target_total - resolved),
        unresolved_sample=sample,
        countable=countable,
        verdict=verdict,
    )
