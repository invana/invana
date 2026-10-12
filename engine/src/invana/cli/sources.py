"""Reading a semantic import's source — a file, or a URL the CLI fetches itself.

The engine never fetches
(docs/for-developers/modules/connect-and-model/features/ontology-import.md), so a
URL is the terminal's to download: the text then goes to the same
manager the API calls. The format comes from ``--format``, else the file's
extension, else the text itself.
"""

from __future__ import annotations

from pathlib import Path

import click
import httpx

from invana.apps.semantic.reader import RdfFormat

_BY_EXTENSION = {
    ".ttl": RdfFormat.turtle,
    ".n3": RdfFormat.turtle,
    ".jsonld": RdfFormat.json_ld,
    ".json": RdfFormat.json_ld,
    ".rdf": RdfFormat.rdf_xml,
    ".xml": RdfFormat.rdf_xml,
}

FORMAT_CHOICES = [f.value for f in RdfFormat]


def read_source(ref: str, fmt: str | None) -> tuple[str, RdfFormat | None]:
    """The text at *ref* and its format, when the option or the extension says."""
    if ref.startswith(("http://", "https://")):
        try:
            response = httpx.get(ref, follow_redirects=True, timeout=60.0)
            response.raise_for_status()
        except httpx.HTTPError as exc:
            raise click.ClickException(f"Could not fetch {ref}: {exc}") from exc
        text, suffix = response.text, Path(httpx.URL(ref).path).suffix.lower()
    else:
        path = Path(ref)
        if not path.is_file():
            raise click.ClickException(f"Cannot read {ref!r}: no such file.")
        text, suffix = path.read_text(encoding="utf-8"), path.suffix.lower()
    if fmt:
        return text, RdfFormat(fmt)
    return text, _BY_EXTENSION.get(suffix)
