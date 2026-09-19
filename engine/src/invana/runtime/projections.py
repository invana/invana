"""Projections — the declared mapping from a shape to a surface.

A projection is a **template plus values** (docs/for-developers/modules/ask/features/projections.md P1).
The template owns the markup; the step supplies values. That is the same reason a
plan is validated against an envelope: a model that can author arbitrary markup
can author anything.

Two directions, one mechanism:

| Direction | Surfaces |
|---|---|
| a step needs something from a person | `choice · multi-choice · boolean · pick-from-graph · value · confirm` |
| records need reading by a person | `table · metric · chart · subgraph · markdown · html` |

The rules this module keeps:

- **`accepts` is checked before render** (P4). A template whose required field is
  missing is refused with the field named, never drawn half-empty.
- **Falling back is explicit** (C9). No template fits → the kind's default, and
  the emission says which was used.
- **A template that cannot accept the shape is offered disabled, with the reason**
  (P10) — never hidden, so a reader can see why the chart is not available.
- **Switching re-renders from the same records** (P5). It never re-runs the query.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import TYPE_CHECKING, Any

from sqlalchemy import or_, select

from invana.runtime.models import ProjectionTemplate

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession

# The emission kinds a result template can produce (the-answer-surface.md C1).
RESULT_KINDS = ("subgraph", "table", "metric", "chart", "prose", "empty")


# ---------------------------------------------------------------------------
# The shape of a result
# ---------------------------------------------------------------------------


@dataclass(frozen=True, slots=True)
class Shape:
    """What a set of records actually looks like — the thing `accepts` is checked against."""

    result_type: str  # "graph" | "tabular"
    row_count: int
    columns: tuple[str, ...] = ()
    numeric_columns: tuple[str, ...] = ()
    node_count: int = 0
    edge_count: int = 0

    @property
    def is_empty(self) -> bool:
        if self.result_type == "graph":
            return self.node_count == 0 and self.edge_count == 0
        return self.row_count == 0

    @property
    def is_single_value(self) -> bool:
        """One row, one column — the shape a question with a number for an answer returns."""
        return self.result_type == "tabular" and self.row_count == 1 and len(self.columns) == 1

    @property
    def is_categorical(self) -> bool:
        """A label column and a number column, over more than one row."""
        return (
            self.result_type == "tabular"
            and self.row_count > 1
            and len(self.columns) == 2
            and len(self.numeric_columns) == 1
        )


def shape_of(result: Any) -> Shape:
    """Read the shape off a ``QueryResponse`` without interpreting it."""
    if result.result_type == "graph":
        data = result.data
        return Shape(
            result_type="graph",
            row_count=result.row_count,
            node_count=len(data.nodes) if data else 0,
            edge_count=len(data.edges) if data else 0,
        )
    rows = result.rows or []
    columns = tuple(rows[0].keys()) if rows else ()
    numeric = tuple(
        column
        for column in columns
        if all(isinstance(row.get(column), (int, float)) and not isinstance(row.get(column), bool) for row in rows)
    )
    return Shape(result_type="tabular", row_count=result.row_count, columns=columns, numeric_columns=numeric)


# ---------------------------------------------------------------------------
# The templates shipped with the distribution
#
# Every Graph has these. They are ordinary rows with `graph_id = NULL`, so a
# Graph's own template competes with them on the same terms.
# ---------------------------------------------------------------------------


@dataclass(frozen=True, slots=True)
class BuiltinTemplate:
    name: str
    surface: str
    intent: str
    accepts: dict[str, Any] = field(default_factory=dict)
    spec: dict[str, Any] = field(default_factory=dict)


BUILTIN_RESULT_TEMPLATES: tuple[BuiltinTemplate, ...] = (
    BuiltinTemplate(
        name="records-table",
        surface="table",
        intent="rows of records",
        accepts={"result_type": "tabular", "min_rows": 1},
    ),
    BuiltinTemplate(
        name="single-value",
        surface="metric",
        intent="one number that answers the question",
        accepts={"result_type": "tabular", "single_value": True},
    ),
    BuiltinTemplate(
        name="category-bars",
        surface="chart",
        intent="a shape across categories",
        accepts={"result_type": "tabular", "categorical": True},
        spec={"chart": "bar"},
    ),
    BuiltinTemplate(
        name="graph-subgraph",
        surface="subgraph",
        intent="what connects to what",
        accepts={"result_type": "graph", "min_rows": 0},
    ),
    BuiltinTemplate(
        name="nothing-held",
        surface="markdown",
        intent="the graph does not hold this",
        accepts={"empty": True},
    ),
)


async def ensure_builtins(session: AsyncSession) -> list[ProjectionTemplate]:
    """Seed the shipped templates once. Idempotent — they are keyed by name."""
    existing = {
        row.name
        for row in (
            await session.execute(select(ProjectionTemplate).where(ProjectionTemplate.graph_id.is_(None)))
        ).scalars()
    }
    created: list[ProjectionTemplate] = []
    for builtin in BUILTIN_RESULT_TEMPLATES:
        if builtin.name in existing:
            continue
        template = ProjectionTemplate(
            graph_id=None,
            name=builtin.name,
            kind="result",
            surface=builtin.surface,
            accepts=dict(builtin.accepts),
            spec=dict(builtin.spec),
            intent=builtin.intent,
        )
        session.add(template)
        created.append(template)
    if created:
        await session.flush()
    return created


async def available_templates(session: AsyncSession, *, graph_id: str) -> list[ProjectionTemplate]:
    """This Graph's result templates, plus the ones shipped with the distribution."""
    stmt = (
        select(ProjectionTemplate)
        .where(
            or_(ProjectionTemplate.graph_id == graph_id, ProjectionTemplate.graph_id.is_(None)),
            ProjectionTemplate.kind == "result",
            ProjectionTemplate.status == "published",
        )
        .order_by(ProjectionTemplate.name)
    )
    return list((await session.execute(stmt)).scalars().all())


# ---------------------------------------------------------------------------
# accepts — checked before render, refused by name
# ---------------------------------------------------------------------------


def accepts_reason(template: ProjectionTemplate, shape: Shape) -> str | None:
    """``None`` when the template can render *shape*; otherwise why it cannot.

    The reason is the whole point: an unavailable template is offered disabled
    with this string, never hidden (P10).
    """
    accepts = template.accepts or {}

    wanted = accepts.get("result_type")
    if wanted and wanted != shape.result_type:
        return f"needs a {wanted} result; this one is {shape.result_type}"

    if accepts.get("empty") and not shape.is_empty:
        return "renders the empty answer; this result has records"
    if not accepts.get("empty") and shape.is_empty:
        return "there are no records to render"

    if accepts.get("single_value") and not shape.is_single_value:
        return "needs one row with one column"
    if accepts.get("categorical") and not shape.is_categorical:
        return "needs a label column and one numeric column, over more than one row"

    min_rows = accepts.get("min_rows")
    if isinstance(min_rows, int) and shape.result_type == "tabular" and shape.row_count < min_rows:
        return f"needs at least {min_rows} row{'' if min_rows == 1 else 's'}"

    for column in accepts.get("columns", []) or []:
        if column not in shape.columns:
            return f"needs a column named {column!r}"

    return None


def select_template(
    templates: list[ProjectionTemplate],
    shape: Shape,
    *,
    intent: str = "",
) -> tuple[ProjectionTemplate | None, list[dict[str, Any]]]:
    """Pick the template for *shape*, and say what every other one would have done.

    Returns the choice and the full offer list — each entry carrying whether it
    can render and, when it cannot, the reason. The picker shows all of them.
    """
    offers: list[dict[str, Any]] = []
    eligible: list[ProjectionTemplate] = []
    for template in templates:
        reason = accepts_reason(template, shape)
        offers.append(
            {
                "template_id": template.id,
                "name": template.name,
                "surface": template.surface,
                "version": template.version,
                "available": reason is None,
                "reason": reason,
            }
        )
        if reason is None:
            eligible.append(template)

    if not eligible:
        return None, offers

    # Intent first — `project` selects a template the way `plan` selects a
    # workflow. Then the most specific shape match, so `single-value` beats
    # `records-table` on a one-cell result rather than losing to it on name order.
    def rank(template: ProjectionTemplate) -> tuple[int, int, str]:
        by_intent = 0 if intent and intent.lower() in (template.intent or "").lower() else 1
        return (by_intent, -_specificity(template), template.name)

    return sorted(eligible, key=rank)[0], offers


# ---------------------------------------------------------------------------
# Rendering — the template's surface, the step's values
# ---------------------------------------------------------------------------


# How much a constraint narrows the shape. Counting keys would make
# `records-table` (result_type + min_rows) tie with `single-value` (result_type +
# single_value), and a one-cell result would render as a one-row table — which is
# the wrong answer to "how many?".
_CONSTRAINT_WEIGHT = {
    "single_value": 4,
    "categorical": 4,
    "empty": 4,
    "columns": 2,
    "min_rows": 1,
    "result_type": 1,
}


def _specificity(template: ProjectionTemplate) -> int:
    return sum(_CONSTRAINT_WEIGHT.get(key, 1) for key in (template.accepts or {}))


def render(template: ProjectionTemplate | None, result: Any, shape: Shape) -> tuple[str, dict[str, Any]]:
    """Turn records into an emission body. Returns ``(kind, payload)``.

    With no template the kind's default is used, and the caller records that no
    template chose the rendering (AS9) rather than filling the header in.
    """
    surface = template.surface if template else _default_surface(shape)

    if shape.is_empty:
        return "empty", {
            "statement": "The graph does not hold records for this question.",
        }

    if surface == "subgraph" or shape.result_type == "graph":
        data = result.data
        return "subgraph", {
            "data": data.model_dump() if data else {"nodes": [], "edges": []},
            "on_canvas": True,
        }

    rows = result.rows or []
    if surface == "metric":
        column = shape.columns[0]
        value = rows[0].get(column)
        return "metric", {"value": _as_text(value), "label": column}

    if surface == "chart":
        label_column = next(c for c in shape.columns if c not in shape.numeric_columns)
        value_column = shape.numeric_columns[0]
        return "chart", {
            "caption": f"{value_column} by {label_column}",
            "chart": (template.spec or {}).get("chart", "bar") if template else "bar",
            "series": [
                {"label": _as_text(row.get(label_column)), "value": float(row.get(value_column) or 0)} for row in rows
            ],
        }

    if surface == "markdown":
        return "prose", {"text": _as_text(rows[0].get(shape.columns[0])) if rows else "", "citations": []}

    return "table", {"rows": rows, "columns": list(shape.columns)}


def _default_surface(shape: Shape) -> str:
    if shape.is_empty:
        return "markdown"
    if shape.result_type == "graph":
        return "subgraph"
    if shape.is_single_value:
        return "metric"
    return "table"


def _as_text(value: Any) -> str:
    if value is None:
        return "—"
    if isinstance(value, float) and value.is_integer():
        return str(int(value))
    return str(value)
