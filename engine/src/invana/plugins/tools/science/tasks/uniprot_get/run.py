"""The ``uniprot.get`` task type; ``manifest.toml`` beside this file declares it."""

from __future__ import annotations

import re

from invana.plugins.sdk import web
from invana.plugins.sdk.context import Out, RunVars, TaskContext

#: UniProtKB accessions and entry names: letters, digits, underscores.
_ACCESSION = re.compile(r"^[A-Za-z0-9_]{1,20}$")


def _entry(data: dict, url: str) -> dict:
    """The fields a plan reasons over, from UniProt's full JSON entry."""
    protein = data.get("proteinDescription") or {}
    name = ((protein.get("recommendedName") or {}).get("fullName") or {}).get("value") or next(
        (n.get("fullName", {}).get("value") for n in protein.get("submissionNames") or []), ""
    )
    organism = data.get("organism") or {}
    function = next(
        (
            text.get("value", "")
            for c in data.get("comments") or []
            if c.get("commentType") == "FUNCTION"
            for text in c.get("texts") or []
        ),
        "",
    )
    sequence = data.get("sequence") or {}
    return {
        "accession": data.get("primaryAccession", ""),
        "id": data.get("uniProtkbId", ""),
        "protein": name,
        "genes": [g["geneName"]["value"] for g in data.get("genes") or [] if (g.get("geneName") or {}).get("value")],
        "organism": organism.get("scientificName", ""),
        "taxon_id": organism.get("taxonId"),
        "length": sequence.get("length"),
        "sequence": sequence.get("value", ""),
        "function": function,
        "url": url,
    }


async def uniprot_get(ctx: TaskContext, v: RunVars) -> Out:
    """One UniProtKB entry as ``{accession, id, protein, genes, organism, taxon_id, length, sequence, function, url}``.

    ``url`` is the entry's UniProt page — the citation. An unknown accession
    is ``blocked · not_found``.
    """
    accession = str((ctx.step.args or {}).get("accession") or "").strip()
    if not _ACCESSION.match(accession):
        raise web.blocked(f"'{accession}' is not a UniProt accession.", cause="bad_args")
    data = await web.get_json(f"https://rest.uniprot.org/uniprotkb/{accession}.json")
    url = f"https://www.uniprot.org/uniprotkb/{data.get('primaryAccession') or accession}/entry"
    entry = _entry(data, url)
    return Out(
        detail=f"UniProt {entry['accession']} · {entry['protein'][:80]}",
        input={"accession": accession},
        output={"entry": entry, "url": url},
    )


run = uniprot_get
