"""The ``pubchem.get`` task type; ``manifest.toml`` beside this file declares it."""

from __future__ import annotations

from urllib.parse import quote

from invana.plugins.sdk import web
from invana.plugins.sdk.context import Out, RunVars, TaskContext

PUG = "https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound"
PROPERTIES = "MolecularFormula,MolecularWeight,IUPACName,CanonicalSMILES,InChIKey,XLogP"


async def pubchem_get(ctx: TaskContext, v: RunVars) -> Out:
    """One compound's properties through PUG REST, looked up by ``cid`` or else by ``name``.

    The compound is ``{cid, formula, weight, iupac_name, smiles, inchikey,
    xlogp, url}``; ``url`` is its PubChem page — the citation. A name that
    matches several compounds returns the first PubChem lists.
    """
    args = ctx.step.args or {}
    cid, name = args.get("cid"), str(args.get("name") or "").strip()
    if cid not in (None, ""):
        try:
            path = f"cid/{int(cid)}"
        except (TypeError, ValueError) as exc:
            raise web.blocked(f"'{cid}' is not a PubChem CID.", cause="bad_args") from exc
    elif name:
        path = f"name/{quote(name, safe='')}"
    else:
        raise web.blocked("Name the compound, or give its CID.", cause="bad_args")

    data = await web.get_json(f"{PUG}/{path}/property/{PROPERTIES}/JSON")
    props = ((data.get("PropertyTable") or {}).get("Properties") or [{}])[0]
    if not props.get("CID"):
        raise web.blocked(f"PubChem has no compound for {path}.", cause="not_found", url=f"{PUG}/{path}")
    url = f"https://pubchem.ncbi.nlm.nih.gov/compound/{props['CID']}"
    compound = {
        "cid": props["CID"],
        "formula": props.get("MolecularFormula", ""),
        "weight": props.get("MolecularWeight"),
        "iupac_name": props.get("IUPACName", ""),
        "smiles": props.get("CanonicalSMILES") or props.get("ConnectivitySMILES") or props.get("SMILES", ""),
        "inchikey": props.get("InChIKey", ""),
        "xlogp": props.get("XLogP"),
        "url": url,
    }
    return Out(
        detail=f"PubChem CID {compound['cid']} · {compound['formula']}",
        input={"cid": cid, "name": name},
        output={"compound": compound, "url": url},
    )


run = pubchem_get
