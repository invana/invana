"""The ``board.open`` task type; ``manifest.toml`` beside this file declares it."""

from __future__ import annotations

from invana.apps.llm.intent import list_words
from invana.core.errors import NotFoundError
from invana.plugins.sdk.context import Out, RunVars, TaskContext
from invana.plugins.sdk.errors import CannotAnswer
from invana.runtime.emissions import to_dict as emission_to_dict


async def board_open(ctx: TaskContext, v: RunVars) -> Out:
    """Open a list with the filters an ask named, and link to it.

    The words come from *Understand*'s ``open_list`` intent, or from the
    step's own ``list`` and ``filters`` when a plan names them. This is a read:
    it resolves, counts and links, and changes nothing the list shows.
    """
    # Imported here: the manager reads the runtime's services, which load the
    # catalogue this module is loaded by.
    from invana.runtime.managers.board_open import BoardOpenManager

    args = ctx.step.args or {}
    words = list_words(v.intent.refs) if v.intent else {}
    words.update({str(k): str(w) for k, w in (args.get("filters") or {}).items() if w})
    list_key = str(args.get("list") or words.get("list") or "")

    manager = BoardOpenManager()
    try:
        link = await manager.open(ctx.db, graph=v.graph, actor_id=v.actor_id, list_key=list_key, words=words)
    except NotFoundError as exc:
        raise CannotAnswer(reason=str(exc)) from exc

    emission = await manager.write(
        ctx.db,
        link=link,
        run_id=ctx.step.parent_run_id,
        message_id=v.assistant_message_id,
        step_id=ctx.step.id,
    )
    await ctx.emit("emission", emission_to_dict(emission))
    v.summary = link.sentence

    n = len(link.chips)
    return Out(
        detail=f"{link.board.label} · {n} filter{'' if n == 1 else 's'} · {link.total}"
        + (f" · {len(link.unresolved)} unresolved" if link.unresolved else ""),
        input={"list": list_key, "filters": {k: w for k, w in words.items() if k != "list"}},
        output={
            "path": link.path,
            "params": link.params,
            "chips": link.chips,
            "total": link.total,
            "unresolved": link.unresolved,
            "emission_id": emission.id,
        },
    )


run = board_open
