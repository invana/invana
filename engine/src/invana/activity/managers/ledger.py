"""Reading the ledger — by row, by actor, by record, by refusal; exported with its hashes
(docs/for-developers/modules/operate/features/the-ledger.md).

The ledger is written by ``invana.core.ledger.record`` and nothing else; this
manager only reads it, and records the exports people take. Every number it
returns is counted here over stored rows — Studio formats, never derives.

**Who sees what.** A Graph owner sees every row. Any other member sees their
own acts and the rows of runs they can open; what they cannot see in the same
filters is counted as ``hidden`` and never shown. A row a member may not see
reads as absent::

    ledger = LedgerManager()
    page = await ledger.page(session, graph=graph, member=member, params=params, applied=[])
    stats = await ledger.stats(session, graph=graph, member=member, since="today")
    name, media_type, chunks = await ledger.export(session, graph=graph, member=member, params=params, fmt="csv")

The clock calls :meth:`LedgerManager.verify_due`: each Graph's chain is
re-verified when its last check is ten minutes old.
"""

from __future__ import annotations

import csv
import io
import json
from collections import Counter, defaultdict
from collections.abc import Iterator
from datetime import UTC, datetime, timedelta

from sqlalchemy.ext.asyncio import AsyncSession

from invana.activity.managers.notifications import Members
from invana.activity.querysets import LedgerReadQuerySet
from invana.activity.querysets.ledger import PRESETS, chain_names, like_pattern
from invana.apps.agents.models import AgentKind
from invana.apps.agents.querysets import AgentQuerySet
from invana.apps.govern.addressing import matches
from invana.apps.govern.querysets.lens import LensQuerySet
from invana.apps.graphs.models import Graph, GraphMember
from invana.apps.graphs.roles import GraphRole
from invana.core import ledger as core_ledger
from invana.core.errors import NotFoundError, ValidationError
from invana.core.ledger.models import LedgerExport, LedgerRow
from invana.core.ledger.querysets import LedgerQuerySet
from invana.core.ledger.schemas import (
    LEDGER_LIST,
    LEDGER_SINCE,
    CanSee,
    CountRow,
    LedgerActorRead,
    LedgerCustody,
    LedgerExportRead,
    LedgerIntegrity,
    LedgerPage,
    LedgerPreset,
    LedgerRecordRead,
    LedgerRefusalsRead,
    LedgerRowDetail,
    LedgerRowRead,
    LedgerStats,
    RefusalRule,
    RefusedDay,
)
from invana.core.lists import AppliedFilter, ListParams

#: How often the clock re-verifies a Graph's chain.
VERIFY_EVERY = timedelta(minutes=10)
#: The 7-day daily mean of acts below which the Acts tile shows no change.
CHANGE_FLOOR = 10
#: How long rows are kept, stated in the head.
RETENTION_DAYS = 365
#: The most rows one export carries.
EXPORT_CAP = 100_000
#: The columns of a CSV export, in order.
EXPORT_COLUMNS = (
    "seq",
    "at",
    "actor_chain",
    "act",
    "layer",
    "touched",
    "touched_line",
    "verdict",
    "refused_by",
    "rule",
    "run_number",
    "where",
    "hash",
    "prev_hash",
)


def since_start(key: str | None, now: datetime) -> datetime | None:
    """The first instant of a ledger window; ``None`` for no window."""
    if not key:
        return None
    if key not in LEDGER_SINCE:
        raise ValidationError(f"since cannot be {key}; it is one of: {', '.join(LEDGER_SINCE)}")
    if key == "today":
        return now.replace(hour=0, minute=0, second=0, microsecond=0)
    return now - {"24h": timedelta(hours=24), "7d": timedelta(days=7), "30d": timedelta(days=30)}[key]


def _chain(row: LedgerRow) -> list[dict]:
    return [
        {"kind": str(link.get("kind") or ""), "id": link.get("id"), "name": str(link.get("name") or "")}
        for link in (row.actor_chain or [])
        if isinstance(link, dict)
    ]


def _read(row: LedgerRow) -> LedgerRowRead:
    return LedgerRowRead(
        id=row.id,
        seq=row.seq,
        at=row.at,
        actor_kind=row.actor_kind,
        actor_chain=_chain(row),
        act=row.act,
        layer=row.layer,
        touched=row.touched,
        touched_line=row.touched_line,
        verdict=row.verdict,
        refused_by=row.refused_by,
        rule=row.rule,
        run_id=row.run_id,
        step_run_id=row.step_run_id,
        run_number=row.run_number,
        where=row.where,
    )


def _name_after_layer(touched: str) -> str:
    return (touched or "").split("/", 1)[-1]


def _who(row: LedgerRow) -> str:
    """The acting end of a row's chain, by name."""
    chain = _chain(row)
    return chain[-1]["name"] if chain else row.actor_kind


def _filters_line(filters: dict) -> str:
    parts = [f"{key} {', '.join(values) if isinstance(values, list) else values}" for key, values in filters.items()]
    return " · ".join(parts) or "all rows"


class LedgerManager:
    """Stateless. The session is the first argument of every method."""

    rows_qs = LedgerReadQuerySet()
    chain_qs = LedgerQuerySet()
    agents_qs = AgentQuerySet()
    lenses_qs = LensQuerySet()

    @staticmethod
    def viewer_id(member: GraphMember) -> str | None:
        """``None`` for an owner, who sees every row; else the member whose rows are narrowed."""
        return None if member.holds(GraphRole.owner) else member.user_id

    # ── Rows ─────────────────────────────────────────────────────────────────

    async def page(
        self,
        session: AsyncSession,
        *,
        graph: Graph,
        member: GraphMember,
        params: ListParams,
        applied: list[AppliedFilter],
        now: datetime | None = None,
    ) -> LedgerPage:
        """One page of the Rows tab, newest first, with what the reader may not see counted."""
        since = since_start(params.one("since"), now or datetime.now(UTC))
        viewer = self.viewer_id(member)
        rows, info = await self.rows_qs.page(session, graph_id=graph.id, viewer_id=viewer, params=params, since=since)
        hidden = await self.rows_qs.hidden(session, graph_id=graph.id, viewer_id=viewer, params=params, since=since)
        return LedgerPage(
            items=[_read(r) for r in rows],
            total=info.total,
            unfiltered_total=info.unfiltered_total,
            next_cursor=info.next_cursor,
            applied=applied,
            hidden=hidden,
        )

    async def stats(
        self,
        session: AsyncSession,
        *,
        graph: Graph,
        member: GraphMember,
        since: str = "today",
        now: datetime | None = None,
    ) -> LedgerStats:
        """The tiles and chip counts over ``since``, against the daily mean of the 7 days before."""
        now = now or datetime.now(UTC)
        start = since_start(since, now)
        viewer = self.viewer_id(member)
        scope = self.rows_qs.scope(graph.id, viewer)
        window = scope.where(LedgerRow.at >= start)
        tallies = await self.rows_qs.tallies(session, window)
        before = await self.rows_qs.count(
            session, scope.where(LedgerRow.at >= start - timedelta(days=7), LedgerRow.at < start)
        )
        mean = before / 7 if before else None
        # A percentage over a near-empty week misleads, so none is given under the floor.
        steady = mean is not None and mean >= CHANGE_FLOOR
        change = round((tallies["acts"] - mean) / mean * 100, 1) if steady else None
        presets = []
        for key, clause in PRESETS.items():
            presets.append(
                LedgerPreset(
                    key=key,
                    label=LEDGER_LIST.filters["preset"].labels[key],
                    count=await self.rows_qs.count(session, window.where(clause)),
                )
            )
        hidden = await self.rows_qs.hidden(
            session, graph_id=graph.id, viewer_id=viewer, params=ListParams(), since=start
        )
        return LedgerStats(
            since=since,
            acts=tallies["acts"],
            acts_7d_mean=round(mean, 1) if mean is not None else None,
            acts_change_pct=change,
            people=tallies["people"],
            people_acts=tallies["people_acts"],
            agents=tallies["agents"],
            agent_acts=tallies["agent_acts"],
            spawned=tallies["spawned"],
            refused=tallies["refused"],
            refused_by=await self.rows_qs.refused_by(session, window),
            waiting_approvals=await self.rows_qs.approvals_waiting(session, graph_id=graph.id, user_id=member.user_id),
            presets=presets,
            hidden=hidden,
        )

    async def detail(self, session: AsyncSession, *, graph: Graph, member: GraphMember, row_id: str) -> LedgerRowDetail:
        """A row's drawer: its chain of custody, the act, integrity, and the rows around it."""
        viewer = self.viewer_id(member)
        row = await self.rows_qs.get(session, graph_id=graph.id, viewer_id=viewer, row_id=row_id)
        if row is None:
            raise NotFoundError("Ledger row not found.")
        check = await self.rows_qs.check(session, graph.id)
        around = await self.rows_qs.around(session, row=row, viewer_id=viewer)
        return LedgerRowDetail(
            row=_read(row),
            custody=await self._custody(session, graph_id=graph.id, row=row),
            args=dict(row.args or {}),
            hash=row.hash,
            prev_hash=row.prev_hash,
            verified=bool(check is not None and check.ok and row.seq <= check.last_seq),
            verified_at=check.verified_at if check is not None else None,
            around=[_read(r) for r in around],
        )

    async def _custody(self, session: AsyncSession, *, graph_id: str, row: LedgerRow) -> list[LedgerCustody]:
        chain = _chain(row)
        agent_ids = [link["id"] for link in chain if link["kind"] == "agent" and link["id"]]
        kinds = {a.id: a.kind for a in await self.agents_qs.by_ids(session, graph_id=graph_id, ids=agent_ids)}
        out: list[LedgerCustody] = []
        for i, link in enumerate(chain):
            prev = chain[i - 1] if i else None
            if link["kind"] == "person":
                line = "started it" if i == 0 else "acted for"
            elif kinds.get(link["id"]) == AgentKind.spawned.value and prev is not None:
                line = f"spawned by {prev['name']}"
            elif prev is not None and prev["kind"] == "agent":
                line = f"delegated by {prev['name']}"
            elif prev is not None:
                line = f"acting for {prev['name']}"
            else:
                line = "acting on its own"
            out.append(LedgerCustody(kind=link["kind"] or "agent", name=link["name"], line=line))
        plugin = (row.args or {}).get("plugin")
        out.append(LedgerCustody(kind="function", name=row.act, line=str(plugin) if plugin else f"{row.layer} layer"))
        if row.where:
            out.append(LedgerCustody(kind="worker", name=row.where, line="where it ran"))
        if row.run_id:
            snapshot = await self.rows_qs.lens_snapshot(session, row.run_id) or {}
            names = [
                str(c.get("name") or c.get("id")) if isinstance(c, dict) else str(c)
                for c in snapshot.get("contributors") or []
            ]
            rules = snapshot.get("rules") or []
            out.append(
                LedgerCustody(
                    kind="lens",
                    name=", ".join(names) or "Everything",
                    line=f"{len(rules)} rule{'' if len(rules) == 1 else 's'}",
                )
            )
        return out

    # ── By actor ─────────────────────────────────────────────────────────────

    async def actor(
        self,
        session: AsyncSession,
        *,
        graph: Graph,
        member: GraphMember,
        actor: str,
        since: str = "7d",
        now: datetime | None = None,
    ) -> LedgerActorRead:
        """A person's or an agent's acts — every row whose chain names it, helpers included."""
        kind, _, actor_id = actor.partition(":")
        if kind not in ("person", "agent") or not actor_id:
            raise ValidationError("actor is person:<id> or agent:<id>.")
        start = since_start(since, now or datetime.now(UTC))
        stmt = self.rows_qs.scope(graph.id, self.viewer_id(member)).where(chain_names(actor_id), LedgerRow.at >= start)
        rows = await self.rows_qs.rows(session, stmt)

        name = ""
        for row in rows:
            name = next((link["name"] for link in _chain(row) if link["id"] == actor_id), "")
            if name:
                break
        if not name:
            if kind == "agent":
                found = await self.agents_qs.get(session, actor_id)
                name = found.name if found is not None and found.graph_id == graph.id else ""
            else:
                name = (await self.rows_qs.usernames(session, [actor_id])).get(actor_id, "")
        if not name and not rows:
            raise NotFoundError("Actor not found.")

        writes = [r for r in rows if r.act.startswith("graph.write.")]
        secrets = [r for r in rows if r.layer == "secret"]
        refused = [r for r in rows if r.verdict == "refused"]
        graph_rows: dict[str, CountRow] = {}
        web_rows: dict[str, CountRow] = {}
        llm_rows: dict[str, CountRow] = {}
        through: dict[str, list] = {}
        llm_steps = [r.step_run_id for r in rows if r.layer == "llm" and r.step_run_id]
        step_tokens = await self.rows_qs.step_tokens(session, step_run_ids=llm_steps)
        for row in rows:
            target = _name_after_layer(row.touched)
            if row.layer == "graph":
                key = target.split(":")[0].split("@")[0] or "graph"
                entry = graph_rows.setdefault(key, CountRow(key=key))
                entry.a += row.act.startswith("graph.read.")
                entry.b += row.act.startswith("graph.write.")
                entry.c += row.verdict == "refused"
            elif row.layer == "web" and row.touched.startswith("web/"):
                key = target.split("/")[0] or "web"
                entry = web_rows.setdefault(key, CountRow(key=key))
                entry.a += 1
                entry.b += row.verdict == "refused"
            elif row.layer == "llm" and row.touched.startswith("llm/"):
                # Keyed by the model's address; the tokens are the step's, as it recorded them.
                entry = llm_rows.setdefault(target, CountRow(key=target))
                entry.a += 1
                entry.b += step_tokens.get(row.step_run_id or "", 0)
            chain = _chain(row)
            at = next((i for i, link in enumerate(chain) if link["id"] == actor_id), None)
            if at is not None:
                for link in chain[at + 1 :]:
                    if link["kind"] == "agent" and link["id"]:
                        through.setdefault(link["id"], [link["name"], 0])[1] += 1
        kinds = {a.id: a.kind for a in await self.agents_qs.by_ids(session, graph_id=graph.id, ids=list(through))}
        acted_through = [
            CountRow(
                key=label,
                a=count,
                line="spawned" if kinds.get(agent_id) == AgentKind.spawned.value else "delegated",
            )
            for agent_id, (label, count) in sorted(through.items(), key=lambda kv: -kv[1][1])
        ]
        by = Counter(r.refused_by or "other" for r in refused)
        return LedgerActorRead(
            actor=actor,
            name=name,
            since=since,
            acts=len(rows),
            writes=len(writes),
            writes_refused=sum(1 for r in writes if r.verdict == "refused"),
            third_party=sum(1 for r in rows if r.layer == "web"),
            secrets=len(secrets),
            secret_names=sorted({_name_after_layer(r.touched) for r in secrets if r.touched}),
            refused=len(refused),
            refused_by=dict(by),
            graph=sorted(graph_rows.values(), key=lambda c: -(c.a + c.b + c.c)),
            web=sorted(web_rows.values(), key=lambda c: -c.a),
            llm=sorted(llm_rows.values(), key=lambda c: -c.a),
            acted_through=acted_through,
        )

    # ── By record ────────────────────────────────────────────────────────────

    async def record(
        self,
        session: AsyncSession,
        *,
        graph: Graph,
        member: GraphMember,
        address: str,
        since: str = "30d",
        now: datetime | None = None,
    ) -> LedgerRecordRead:
        """Every act on an address and who can see it now, read from govern."""
        address = address.strip()
        if "/" not in address:
            raise ValidationError("address is layer/name — graph/Airport:LHR, graph/Fare.")
        start = since_start(since, now or datetime.now(UTC))
        stmt = self.rows_qs.scope(graph.id, self.viewer_id(member)).where(
            LedgerRow.touched.like(like_pattern(address) + "%", escape="\\"), LedgerRow.at >= start
        )
        rows = await self.rows_qs.rows(session, stmt)
        writes = [r for r in rows if r.act.startswith("graph.write.")]
        refused = [r for r in rows if r.verdict == "refused"]
        people = {link["id"] for r in rows for link in _chain(r) if link["kind"] == "person" and link["id"]}
        agents = {link["id"] for r in rows for link in _chain(r) if link["kind"] == "agent" and link["id"]}
        writers = Counter(_who(r) for r in writes if r.verdict == "allowed")
        by = Counter(r.refused_by or "other" for r in refused)
        return LedgerRecordRead(
            address=address,
            since=since,
            acts=len(rows),
            reads=sum(1 for r in rows if r.act.startswith("graph.read.")),
            writes=len(writes),
            writes_line=", ".join(f"{who} x{n}" for who, n in writers.most_common(3)),
            refused=len(refused),
            refused_line=" · ".join(f"{key} {n}" for key, n in by.most_common()),
            people=len(people),
            agents=len(agents),
            rows=[_read(r) for r in rows[:50]],
            can_see=await self._can_see(session, graph=graph, address=address, writers=list(writers)),
        )

    async def _can_see(self, session: AsyncSession, *, graph: Graph, address: str, writers: list[str]) -> CanSee:
        """The worlds that name the address's type, the members, the agents, and who has written it."""
        type_name = _name_after_layer(address).split(":")[0].split("/")[0]
        govern_address = f"graph_data/model/{type_name}"
        worlds = []
        for lens in await self.lenses_qs.worlds_for_graph(session, graph.id):
            raw = [r for r in (lens.rules or []) if isinstance(r, dict) and isinstance(r.get("match"), str)]
            try:
                denied = any(not r.get("allow") and matches(r["match"], govern_address) for r in raw)
                allowed = any(r.get("allow") and matches(r["match"], govern_address) for r in raw)
            except ValueError:
                continue
            if not denied and (allowed or "graph_data" not in (lens.closed_layers or [])):
                worlds.append(lens.display_name)
        members = await Members.of(session, graph_id=graph.id)
        active = await self.agents_qs.list_active_for_graph(session, graph_id=graph.id)
        count = len(members.rows)
        return CanSee(
            worlds=worlds,
            people=f"{count} member{'' if count == 1 else 's'}",
            agents=f"{len(active)} active agent{'' if len(active) == 1 else 's'}, within these worlds",
            can_write=", ".join(writers) or "nobody has written it",
        )

    # ── Refusals ─────────────────────────────────────────────────────────────

    async def refusals(
        self, session: AsyncSession, *, graph: Graph, member: GraphMember, now: datetime | None = None
    ) -> LedgerRefusalsRead:
        """Today's refusals, a 30-day series, the top refused functions and the rules that held."""
        now = now or datetime.now(UTC)
        today = since_start("today", now)
        first = today - timedelta(days=29)
        scope = self.rows_qs.scope(graph.id, self.viewer_id(member))
        acts_today = await self.rows_qs.count(session, scope.where(LedgerRow.at >= today))
        rows = await self.rows_qs.rows(session, scope.where(LedgerRow.verdict == "refused", LedgerRow.at >= first))
        todays = [r for r in rows if r.at >= today]
        by_today = Counter(r.refused_by or "other" for r in todays)
        per_day = Counter(r.at.astimezone(UTC).date() for r in rows)
        days = [(first + timedelta(days=i)).date() for i in range(30)]
        by_day = [RefusedDay(day=day, refused=per_day.get(day, 0)) for day in days]
        functions: dict[str, list] = {}
        groups: dict[tuple[str, str], list[LedgerRow]] = defaultdict(list)
        for row in rows:
            entry = functions.setdefault(row.act, [0, Counter()])
            entry[0] += 1
            entry[1][row.rule or row.refused_by or ""] += 1
            groups[(row.refused_by or "other", row.rule)].append(row)
        top_functions = [
            CountRow(key=act, a=n, line=rules.most_common(1)[0][0] if rules else "")
            for act, (n, rules) in sorted(functions.items(), key=lambda kv: -kv[1][0])[:10]
        ]
        by_rule = []
        for (refused_by, rule), members in sorted(groups.items(), key=lambda kv: -len(kv[1])):
            what, n = Counter(r.touched or r.act for r in members).most_common(1)[0]
            who = list(dict.fromkeys(_who(r) for r in members))[:3]
            by_rule.append(
                RefusalRule(
                    rule=rule or f"refused by {refused_by}",
                    refused_by=refused_by,
                    today=sum(1 for r in members if r.at >= today),
                    what=f"{what} x{n}",
                    who=", ".join(who),
                    the_rule=rule,
                )
            )
        return LedgerRefusalsRead(
            refused_today=len(todays),
            acts_today=acts_today,
            share_pct=round(len(todays) / acts_today * 100, 1) if acts_today else None,
            by_grant=by_today.get("grant", 0),
            by_lens=by_today.get("lens", 0),
            by_ceiling=by_today.get("ceiling", 0),
            by_robots=by_today.get("robots", 0),
            by_world=by_today.get("world", 0),
            by_day=by_day,
            top_functions=top_functions,
            by_rule=by_rule,
        )

    # ── Export ───────────────────────────────────────────────────────────────

    async def export(
        self,
        session: AsyncSession,
        *,
        graph: Graph,
        member: GraphMember,
        params: ListParams,
        fmt: str,
        now: datetime | None = None,
    ) -> tuple[str, str, list[str]]:
        """The Rows filters as a file, oldest first, with each row's hash and the previous.

        Returns the file name, its media type and its text in chunks, and records
        the export. The rows are read here, inside the request, so the file is
        whole whatever happens to the session after.
        """
        if fmt not in ("csv", "jsonl"):
            raise ValidationError("format is csv or jsonl.")
        now = now or datetime.now(UTC)
        since = since_start(params.one("since"), now)
        stmt = self.rows_qs.filtered(self.rows_qs.scope(graph.id, self.viewer_id(member)), params, since=since)
        rows = list(reversed(await self.rows_qs.rows(session, stmt, limit=EXPORT_CAP)))
        filters = {key: list(values) for key, values in params.filters.items()}
        if params.q:
            filters["q"] = [params.q]
        await self.rows_qs.add_export(
            session,
            LedgerExport(
                graph_id=graph.id, requested_by_id=member.user_id, filters=filters, format=fmt, rows=len(rows)
            ),
        )
        chunks = list(self._csv(rows) if fmt == "csv" else self._jsonl(rows))
        media = "text/csv" if fmt == "csv" else "application/x-ndjson"
        return f"ledger-{graph.slug}-{now:%Y%m%d-%H%M%S}.{fmt}", media, chunks

    @staticmethod
    def _values(row: LedgerRow) -> dict:
        return {
            "seq": row.seq,
            "at": row.at.astimezone(UTC).isoformat(),
            "actor_chain": " ▸ ".join(link["name"] for link in _chain(row)),
            "act": row.act,
            "layer": row.layer,
            "touched": row.touched,
            "touched_line": row.touched_line,
            "verdict": row.verdict,
            "refused_by": row.refused_by or "",
            "rule": row.rule,
            "run_number": row.run_number if row.run_number is not None else "",
            "where": row.where,
            "hash": row.hash,
            "prev_hash": row.prev_hash,
        }

    def _csv(self, rows: list[LedgerRow]) -> Iterator[str]:
        buf = io.StringIO()
        writer = csv.DictWriter(buf, fieldnames=EXPORT_COLUMNS)
        writer.writeheader()
        for i, row in enumerate(rows, 1):
            writer.writerow(self._values(row))
            if i % 500 == 0:
                yield buf.getvalue()
                buf.seek(0)
                buf.truncate()
        yield buf.getvalue()

    def _jsonl(self, rows: list[LedgerRow]) -> Iterator[str]:
        for row in rows:
            values = self._values(row)
            values["actor_chain"] = _chain(row)
            values["run_number"] = row.run_number
            values["refused_by"] = row.refused_by
            yield json.dumps(values, ensure_ascii=False) + "\n"

    async def exports(self, session: AsyncSession, *, graph: Graph) -> list[LedgerExportRead]:
        """The Graph's exports, newest first."""
        rows = await self.rows_qs.exports(session, graph_id=graph.id)
        names = await self.rows_qs.usernames(session, sorted({r.requested_by_id for r in rows if r.requested_by_id}))
        return [
            LedgerExportRead(
                id=r.id,
                requested_by_name=names.get(r.requested_by_id) if r.requested_by_id else None,
                filters_line=_filters_line(r.filters or {}),
                format=r.format,
                rows=r.rows,
                created_at=r.created_at,
            )
            for r in rows
        ]

    # ── Integrity ────────────────────────────────────────────────────────────

    async def integrity(self, session: AsyncSession, *, graph: Graph, full: bool = False) -> LedgerIntegrity:
        """When the chain last held; with ``full``, re-verified from the first row now."""
        check = (
            await core_ledger.verify(session, graph.id, full=True)
            if full
            else await self.rows_qs.check(session, graph.id)
        )
        total = await self.rows_qs.total(session, graph.id)
        if check is None:
            return LedgerIntegrity(retention_days=RETENTION_DAYS, rows=total)
        return LedgerIntegrity(
            verified_at=check.verified_at,
            ok=check.ok,
            last_seq=check.last_seq,
            broken_seq=check.broken_seq,
            retention_days=RETENTION_DAYS,
            rows=total,
        )

    async def verify_due(self, session: AsyncSession, *, now: datetime | None = None) -> int:
        """Re-verify every Graph whose last check is ten minutes old; how many were verified."""
        now = now or datetime.now(UTC)
        done = 0
        for graph_id in await self.chain_qs.graph_ids(session):
            check = await self.chain_qs.check(session, graph_id)
            if check is None or check.verified_at <= now - VERIFY_EVERY:
                await core_ledger.verify(session, graph_id)
                done += 1
        return done
