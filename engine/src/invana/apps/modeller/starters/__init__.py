"""Starter models — ordinary portable artefacts shipped with the distribution.

Nothing here is a built-in schema (docs/for-developers/modules/connect-and-model/features/starter-models.md
SR1). A starter is a file in exactly the format `invana models export` writes, it
lands through exactly the import path any other artefact lands through, and it
arrives as a **draft** so its types can be renamed before they are published (SR3).

No product behaviour reads these names (SR2). Delete every type but two, rename
them, and nothing breaks.
"""

from __future__ import annotations

import json
from functools import cache
from pathlib import Path

from pydantic import BaseModel

from invana.apps.modeller.portability import ModelArtefact, compute_content_hash

_DIR = Path(__file__).resolve().parent


class StarterSummary(BaseModel):
    """What the picker lists, without loading the whole artefact."""

    slug: str
    name: str
    description: str
    version: str | None = None
    package_id: str
    node_types: list[str] = []
    edge_types: list[str] = []


@cache
def _load(slug: str) -> ModelArtefact:
    path = _DIR / f"{slug}.json"
    if not path.is_file():
        msg = f"No starter model named '{slug}'."
        raise KeyError(msg)
    artefact = ModelArtefact.model_validate(json.loads(path.read_text()))
    # The shipped file leaves the hash blank; it is derived, so it is computed the
    # same way an export computes it rather than being maintained by hand.
    artefact.content_hash = compute_content_hash(artefact.model)
    return artefact


def slugs() -> list[str]:
    return sorted(p.stem for p in _DIR.glob("*.json"))


def get(slug: str) -> ModelArtefact:
    """The starter as an artefact — the same object an import takes."""
    return _load(slug).model_copy(deep=True)


def summaries() -> list[StarterSummary]:
    out: list[StarterSummary] = []
    for slug in slugs():
        artefact = _load(slug)
        out.append(
            StarterSummary(
                slug=slug,
                name=artefact.name,
                description=artefact.description,
                version=artefact.version,
                package_id=artefact.package_id,
                node_types=[nt.name for nt in artefact.model.node_types],
                edge_types=[et.name for et in artefact.model.edge_types],
            )
        )
    return out
