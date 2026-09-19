"""The file-shape rules, enforced.

`import-linter` checks the direction *between* packages. These six check the
shape *inside* one — the rules in
``docs/for-developers/building-engine/migration-plan.md`` §4.1, §21.

Each check carries an ``ALLOWED`` list of the violations that still exist.
**Deleting an entry is how a conversion is finished**; adding one means the map
is wrong, and the doc changes first.
"""

from __future__ import annotations

import ast
import io
import re
import tokenize
from pathlib import Path

SRC = Path(__file__).resolve().parents[2] / "src" / "invana"


def _py(*under: str) -> list[Path]:
    roots = [SRC / u for u in under] if under else [SRC]
    return [p for r in roots for p in r.rglob("*.py") if "__pycache__" not in str(p)]


def _rel(p: Path) -> str:
    return str(p.relative_to(SRC))


def _code(p: Path) -> str:
    """The file with comments and string literals removed.

    A docstring that *mentions* ``select()`` is prose, not a query — matching
    raw text would make every rule here unwriteable.
    """
    out = []
    try:
        for tok in tokenize.generate_tokens(io.StringIO(p.read_text()).readline):
            if tok.type in (tokenize.COMMENT, tokenize.STRING):
                continue
            out.append(tok.string)
    except (tokenize.TokenError, IndentationError, SyntaxError):
        return p.read_text()
    return " ".join(out)


# ── 1 · every SQLAlchemy query lives in a queryset ───────────────────────────
#
# Exempt by §4.1: `graph/connectors/*/querysets/` is the same word against a
# graph database; `core/migrations/versions/` is raw by nature.
_QUERY = re.compile(r"\b(?:select|sa_update|sa_delete)\s*\(")

QUERIES_ALLOWED = {
    # datasets' views were moved for the band, not yet converted. They go with
    # the /datasets routes (task-model-migration § 6.7).
    "server/datasets/views.py",
    # the runtime's own split (planner · state · stream) is its own change
    "runtime/services.py",
    "runtime/stream.py",
    "runtime/emissions.py",
    "runtime/projections.py",
    "runtime/delegation.py",
    "runtime/catalogue/pure.py",
    "runtime/interpreter/loop.py",
    "runtime/managers/agent_lifecycle.py",
    "runtime/managers/task_plan_runs.py",
    "activity/managers/tree.py",
    "activity/managers/task_read.py",
    "apps/modeller/links.py",
    "apps/modeller/versioner.py",
    "apps/setup/managers/setup.py",
    "apps/task_plans/managers/task_plan.py",
    "core/auth/managers/auth.py",
    "core/auth/tokens.py",
    "server/routes/models.py",
    "server/routes/model_links.py",
    "server/routes/schemas.py",
    "server/graphs/views.py",
    "server/runtime/runs.py",
    "server/runtime/templates.py",
    "server/sessions/views.py",
    "apps/graphs/query_service.py",
    "apps/graphs/pool.py",
    # a dependency resolves the Graph from the URL before any manager runs
    "server/graphs/deps.py",
}


def test_queries_live_in_querysets() -> None:
    offenders = set()
    for p in _py():
        rel = _rel(p)
        if rel.startswith(("graph/", "core/migrations/")) or "/querysets/" in rel or rel.endswith("/store.py"):
            continue
        if _QUERY.search(_code(p)):
            offenders.add(rel)
    new = offenders - QUERIES_ALLOWED
    assert not new, f"A select() outside a queryset (migration-plan §4.1): {sorted(new)}"


# ── 2 · a manager or queryset never imports fastapi ──────────────────────────
def test_managers_and_querysets_are_http_free() -> None:
    offenders = []
    for p in _py():
        rel = _rel(p)
        if "/managers/" not in rel and "/querysets/" not in rel:
            continue
        if re.search(r"(?<![\w.])fastapi(?![\w.])", _code(p)):
            offenders.append(rel)
    assert not offenders, f"A manager that imports fastapi is a view in the wrong file: {offenders}"


# ── 3 · the request owns the transaction ─────────────────────────────────────
COMMIT_ALLOWED = {
    # the runtime commits between steps; it is not serving a request
    "runtime/interpreter/loop.py",
    "runtime/services.py",
    "runtime/stream.py",
    "runtime/contention.py",
    "server/runtime/runs.py",
    "server/runtime/templates.py",
    "server/datasets/views.py",
    "server/routes/models.py",
    "server/routes/model_links.py",
    "server/routes/auth.py",
    "server/graphs/views.py",
    "server/sessions/views.py",
    "server/admin/auth.py",
    "runtime/catalogue/records.py",
    # A CLI command is not serving a request: it opens its own session and owns
    # the transaction itself. §18.1 binds the *request*, and there isn't one.
    "cli/commands/records.py",
    "cli/commands/init.py",
    # `invana loader --graph` opens a `bulk-load@1` run and then dispatches it,
    # so the row has to be committed before the runtime reads it in its own
    # session — the same shape `records.py` above already has.
    "cli/commands/loader.py",
    "cli/commands/models.py",
    "cli/commands/stitches.py",
    "cli/commands/users.py",
    # the app factory commits during startup wiring, before any request exists
    "server/app.py",
}


def test_views_and_cli_do_not_commit() -> None:
    offenders = set()
    for p in _py("server", "cli"):
        rel = _rel(p)
        code = _code(p)
        if "session . commit (" in code or "db . commit (" in code:
            offenders.add(rel)
    new = offenders - COMMIT_ALLOWED
    assert not new, f"The request owns the transaction (migration-plan §18.1): {sorted(new)}"


# ── 4 · a routes.py defines no function ──────────────────────────────────────
def test_routes_files_define_no_function() -> None:
    offenders = []
    for p in _py("server"):
        if p.name != "routes.py":
            continue
        tree = ast.parse(p.read_text())
        defs = [n.name for n in tree.body if isinstance(n, ast.FunctionDef | ast.AsyncFunctionDef)]
        if defs:
            offenders.append((_rel(p), defs))
    assert not offenders, f"routes.py maps paths to views and nothing else: {offenders}"


# ── 5 · the CLI calls managers, not models ───────────────────────────────────
CLI_ALLOWED = {
    # `invana init` and the loaders construct rows directly; converting them is
    # the same work as converting the record loaders.
    "cli/commands/init.py",
    "cli/commands/loader.py",
    "cli/commands/records.py",
    "cli/commands/stitches.py",
    "cli/commands/models.py",
    "cli/commands/users.py",
    "cli/principal.py",
    # `invana migrate` and friends name models to register metadata
    "cli/main.py",
}


def test_cli_goes_through_managers() -> None:
    offenders = set()
    for p in _py("cli"):
        if re.search(r"invana \. [\w. ]*\. (models|querysets) import", _code(p)):
            offenders.add(_rel(p))
    new = offenders - CLI_ALLOWED
    assert not new, f"`cli` and `server` are peers over the managers (migration-plan §4.1): {sorted(new)}"


# ── 6 · emission belongs to the manager that does the write ──────────────────
EMIT_ALLOWED = {
    "core/events/services.py",
    "core/events/managers/event.py",
    "server/routes/models.py",
    "server/routes/model_links.py",
    "server/routes/auth.py",
    "server/graphs/views.py",
    "server/sessions/views.py",
    "server/task_plans/views.py",
    "server/runtime/runs.py",
    "server/runtime/templates.py",
    "server/datasets/views.py",
    "cli/commands/stitches.py",
    "runtime/catalogue/records.py",
    "runtime/catalogue/stitching.py",
    "apps/graphs/pool.py",
    "apps/explorer/managers/explore.py",
    "runtime/services.py",
    "runtime/delegation.py",
    "runtime/interpreter/loop.py",
    "runtime/catalogue/work_write.py",
    "runtime/managers/agent_lifecycle.py",
    # a failed credential check is recorded where it is detected
    "core/auth/deps.py",
    "apps/graphs/query_service.py",
    # catalogue steps emit their own trace as they run
    "runtime/catalogue/llm.py",
    "runtime/catalogue/schema_write.py",
}


def test_events_are_emitted_by_managers() -> None:
    offenders = set()
    for p in _py():
        rel = _rel(p)
        if "/managers/" in rel:
            continue
        if re.search(r"(?<![\w.])emit_event \(", _code(p)):
            offenders.add(rel)
    new = offenders - EMIT_ALLOWED
    assert not new, f"A write emits from its manager (migration-plan §14.3 E3): {sorted(new)}"
