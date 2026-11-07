#!/usr/bin/env python3
"""Generate the Invana platform map dataset from specs/.

Walks specs/products/*/product.md → features/*/feature.md → stories/*/story.md and writes one
`@invana/graph-datasets` module: the Invana platform at the root, its products, each product's features and each
feature's stories, as a tree of nodes and edges. Every product, feature and story carries the personas its front
matter names; every feature also carries the access its Access table grants.

    python3 .claude/skills/platform-map/gen.py            # write the dataset into the canvas repo
    python3 .claude/skills/platform-map/gen.py --check    # exit 1 if the dataset is stale
    python3 .claude/skills/platform-map/gen.py --out F    # write somewhere else
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[3]
SPECS = REPO / "specs"
DEFAULT_OUT = (
    Path.home() / "Projects/invana/canvas/packages/graph-datasets/src/usecase-demos/invana-platform/data.ts"
)

# The persona keys of specs/personas.md, in its order — the order of the chip slots on every card.
PERSONAS = ["analyst", "decision-maker", "modeller", "curator", "builder", "owner", "admin"]

# Grant → the phrases an Access table's Role column names it by (specs/personas.md › The two lenses).
GRANTS: list[tuple[str, str, re.Pattern[str]]] = [
    ("operator", "Operator", re.compile(r"\bOperator\b")),
    ("projects", "Can work on projects", re.compile(r"Can work on projects|`contributor`")),
    ("agents", "Can build agents", re.compile(r"Can build agents|`builder`")),
    ("model", "Can shape the model", re.compile(r"Can shape the model|`modeller`")),
    ("owner", "Owner", re.compile(r"\*Owner\*|`owner`|\bOwner\b")),
    ("people", "Can manage people", re.compile(r"Can manage people|`iam-admin`")),
    ("admin", "Admin", re.compile(r"\bAdmin\b")),
]


def front_matter(path: Path) -> tuple[dict[str, object], str]:
    """Split a spec file into its front matter (flat keys, `[a, b]` lists) and its body."""
    text = path.read_text(encoding="utf-8")
    meta: dict[str, object] = {}
    if not text.startswith("---"):
        return meta, text
    head, _, body = text[3:].partition("\n---")
    for line in head.strip().splitlines():
        key, sep, value = line.partition(":")
        if not sep:
            continue
        value = value.strip()
        if value.startswith("[") and value.endswith("]"):
            meta[key.strip()] = [v.strip() for v in value[1:-1].split(",") if v.strip()]
        else:
            meta[key.strip()] = value
    return meta, body


def summary(body: str) -> str:
    """The first sentence of the spec's opening blockquote."""
    quote = " ".join(
        line.lstrip("> ").strip() for line in body.splitlines() if line.startswith(">")
    ).split(" The decision it helps make")[0]
    first = re.split(r"(?<=[.;])\s", quote, maxsplit=1)[0]
    return first.strip()


def persona_flags(meta: dict[str, object]) -> dict[str, int]:
    """`{persona: 1}` for every persona the front matter names — a card draws a chip where the key is present."""
    names = meta.get("personas") or []
    return {p: 1 for p in PERSONAS if p in names}


def access(body: str) -> list[str]:
    """The grants a feature's Access table names, in the lens order of specs/personas.md."""
    section = re.search(r"^## Access\n(.*?)(?=^## |\Z)", body, re.S | re.M)
    if not section:
        return []
    roles = " ".join(
        cells[2]
        for row in section.group(1).splitlines()
        if row.startswith("|") and len(cells := row.split("|")) > 3 and not cells[2].strip().startswith(("Role", "---"))
    )
    grants = [label for _, label, pattern in GRANTS if pattern.search(roles)]
    if not grants and "themselves" in roles:
        return ["Self only"]
    return grants


def build() -> dict[str, list[dict[str, object]]]:
    """Read specs/ into the map's nodes and edges."""
    nodes: list[dict[str, object]] = []
    edges: list[dict[str, object]] = []
    products = sorted(SPECS.glob("products/*/product.md"))
    n_features = n_stories = 0

    for hue, product_md in enumerate(products, start=1):
        pmeta, pbody = front_matter(product_md)
        pid = str(pmeta["id"])
        features = sorted(product_md.parent.glob("features/*/feature.md"))
        p_stories = 0
        feature_nodes: list[dict[str, object]] = []
        for feature_md in features:
            fmeta, fbody = front_matter(feature_md)
            fid = str(fmeta["id"])
            stories = sorted(feature_md.parent.glob("stories/*/story.md"))
            grants = access(fbody)
            feature_nodes.append({
                "id": fid,
                "type": "feature",
                "data": {
                    "code": fid,
                    "name": fmeta.get("title", fid),
                    "status": fmeta.get("status", ""),
                    "product": pid,
                    "hue": hue,
                    "p": persona_flags(fmeta),
                    "access": " · ".join(grants) if grants else "—",
                    "grants": grants,
                    "stories": f"{len(stories)} {'story' if len(stories) == 1 else 'stories'}",
                },
            })
            edges.append({"id": f"{pid}->{fid}", "source": pid, "target": fid, "type": "offers"})
            for story_md in stories:
                smeta, _ = front_matter(story_md)
                sid = str(smeta["id"])
                feature_nodes.append({
                    "id": sid,
                    "type": "story",
                    "data": {
                        "code": sid,
                        "name": smeta.get("title", sid),
                        "status": smeta.get("status", ""),
                        "feature": fid,
                        "hue": hue,
                        "p": persona_flags(smeta),
                    },
                })
                edges.append({"id": f"{fid}->{sid}", "source": fid, "target": sid, "type": "delivered by"})
            p_stories += len(stories)
        nodes.append({
            "id": pid,
            "type": "product",
            "data": {
                "code": pid,
                "name": pmeta.get("title", pid),
                "status": pmeta.get("status", ""),
                "summary": summary(pbody),
                "hue": hue,
                "p": persona_flags(pmeta),
                "counts": f"{len(features)} features · {p_stories} stories",
            },
        })
        nodes.extend(feature_nodes)
        edges.append({"id": f"invana->{pid}", "source": "invana", "target": pid, "type": "ships"})
        n_features += len(features)
        n_stories += p_stories

    _, vision = front_matter(SPECS / "vision.md")
    tagline = re.search(r"^\*\*(.+?)\*\*", vision, re.M)
    nodes.insert(0, {
        "id": "invana",
        "type": "platform",
        "data": {
            "code": "PLATFORM",
            "name": "Invana",
            "summary": tagline.group(1) if tagline else "",
            "counts": f"{len(products)} products · {n_features} features · {n_stories} stories",
        },
    })
    return {"nodes": nodes, "edges": edges}


HEADER = """\
/**
 * **Invana platform map** — every product, feature and user story in Invana's
 * product specs, as one tree: the platform at the root, the products it ships,
 * the features each product offers and the stories each feature is delivered by.
 *
 * **Generated — do not edit.** The source is `specs/` in the invana repo; the
 * `platform-map` skill regenerates this file from it.
 *
 * Who each node is for rides on its data, never on its style:
 *
 *   - `data.p` — the personas the spec names, as `{ [persona]: 1 }`. The keys
 *     are `analyst` · `decision-maker` · `modeller` · `curator` · `builder` ·
 *     `owner` · `admin`; a consumer draws one chip slot per key and lets a
 *     missing key leave its slot empty.
 *   - `data.access` / `data.grants` (features only) — the access the feature's
 *     Access table grants: `Operator` · `Can work on projects` · `Can build
 *     agents` · `Can shape the model` · `Owner` · `Can manage people` · `Admin`.
 *   - `data.hue` — the product's 1-based slot in the theme's categorical ramp,
 *     inherited by its features and stories, so a product's subtree reads as one
 *     colour in every theme.
 *
 * Edges point root → leaf (`ships` · `offers` · `delivered by`), so a
 * hierarchy layout finds `invana` as the single root.
 *
 * @example
 * import { invanaPlatform } from '@invana/graph-datasets/usecase-demos';
 * <GraphCanvasApp data={invanaPlatform} config={config} />
 */

"""


def render(graph: dict[str, list[dict[str, object]]]) -> str:
    """The dataset module, one node or edge per line."""
    def lines(items: list[dict[str, object]]) -> str:
        return "\n".join(f"    {json.dumps(item, ensure_ascii=False)}," for item in items)

    return (
        HEADER
        + "export const invanaPlatform = {\n"
        + f"  nodes: [\n{lines(graph['nodes'])}\n  ],\n"
        + f"  edges: [\n{lines(graph['edges'])}\n  ],\n"
        + "};\n"
    )


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--out", type=Path, default=DEFAULT_OUT, help="dataset file to write")
    parser.add_argument("--check", action="store_true", help="exit 1 if the dataset is stale; write nothing")
    args = parser.parse_args()

    graph = build()
    text = render(graph)
    if args.check:
        current = args.out.read_text(encoding="utf-8") if args.out.exists() else ""
        if current != text:
            print(f"stale: {args.out} — run gen.py to regenerate")
            return 1
        print(f"fresh: {args.out}")
        return 0
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(text, encoding="utf-8")
    print(f"wrote {args.out} — {len(graph['nodes'])} nodes · {len(graph['edges'])} edges")
    return 0


if __name__ == "__main__":
    sys.exit(main())
