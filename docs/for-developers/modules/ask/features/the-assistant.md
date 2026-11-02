# The assistant

One assistant, reachable from every surface, taking the right side of the page with the current
selection already in hand. Not a page you navigate to and re-explain yourself on.

| | |
|---|---|
| Index | [3.10](../../../README.md#3--ask) · Slice **S12** |
| Module | [Ask](../spec.md) |
| API / CLI / Studio | ✅ / — / ✅ |
| Related | [ask-in-natural-language](ask-in-natural-language.md) · [the-answer-surface](the-answer-surface.md) · [selection-and-the-panel](../../explore/features/selection-and-the-panel.md) |

Product spec: [EX-F03 · Ask a question](../../../../../specs/products/explore/features/EX-F03-ask-a-question/feature.md) — the stories, their criteria, journey, states and product decisions live there. This file keeps the engine and code shape.

## Surfaces

| Surface | Shape |
|---|---|
| Region | `rightSection` with `?right=assistant`; the page stays visible and usable beside it. `ASSISTANT_SECTION`: opens at 440px, no narrower than 320px (AD26) |
| Header | `Ask Assistant` on the list; `Ask Assistant › <session title>` inside a thread, the first crumb being the way back (AD14) |
| Attachment chip | What is attached, with a remove — **in the composer**, directly above the input (AD10) |
| Thread | Question · steps · emissions, exactly as the main ask surface; each turn carries a small world tag |
| World picker | In the composer, between the ask kind and the agent ([WO5](../../govern/features/worlds.md#decisions)) — an inline **`RichSelect`** like every other composer control ([AD18](#decisions)). Opens upward: *Ask in* · Everything and each world with its description, a stale one disabled with its reason · ☐ *Next ask only* · *Manage worlds…* |
| Session settings | A popover from the thread header's settings button: the spend per run, with the agent's cap beside it | `Popover` · `Field` |
| Centred start | `AssistantStart` on the Graph's page while the right side does not hold the assistant: the kit's `EmptyState` (the question as its title; the Graph's description · `<n> models` · `live on <database>` as its description), the composer with the world picker and the Graph's default agent, `RecentSessions` |
| Failed query | The kit's `DiagnosisCard`: the error's first line, clamped to two; the engine's next steps; **Open the log**, which opens the console on Log where the whole error is |
| Reopen | The header's `Assistant` button, and `AssistantReopenPill` over the canvas while a conversation is open and the assistant is not |
| Ask kind | One inline `RichSelect`, `Ask mode`: Ask · Cypher · Gremlin — the languages the connector speaks |

## Engine

| Thing | Shape |
|---|---|
| Sessions | one per subject; it resumes rather than starting fresh · `lens_id?` and `max_tokens_run?` are its defaults ([AS5](../spec.md#7b-a-session-executes-through-plans-always)) |
| Attachment | the selection passed as context on the todo |
| Routes | the ordinary ask routes; the assistant is a surface, not an API |

## Decisions

| # | Decision |
|---|---|
| AD12 | **It is a graph-page feature, not an Explore one.** It belongs to [Ask](../spec.md), the module that owns asking — its composer, emissions and trace already live there. Explore's stake is only *where* it sits (the right side, [E7](../../explore/spec.md)) and *what* it inherits (the canvas selection). Filing it under Explore made the one surface look like one panel's affordance, and put its code in `features/explore/`. |
| AD14 | **The panel is called `Ask Assistant`.** The header named the contents — `Sessions` — which stopped being true when it moved: the region holds the assistant, and sessions are what the assistant holds. `Ask` qualifies it because it is [Ask](../spec.md)'s surface, and because "Assistant" alone is the product-wide noun for the thing rather than the name of this panel. Inside it everything is still **sessions**: the list, `Search sessions`, `Refresh sessions`. |
| AD5 | It uses the ordinary ask runtime — no second path. |
| AD6 | It is the Sessions panel, moved, and renamed **`AssistantViewPanel`** for the occupant it is rather than the contents it holds. Nothing inside it is redesigned: it already switches between the list and the open thread, and its composer already names the bound agent. **What is inside stays sessions** — a session belongs to the graph, not to the assistant, so `Session*` components and `useSessions` keep their names. |
| AD7 | It is the `assistant` value of `?right=`, independent of the left panel's `?panel=`, so opening it costs nothing else on screen. The region is the param and the occupant is the value ([graph-detail-page.md](../../../building-studio/graph-detail-page.md) G16); `?ai=` is read as a legacy alias and never written. |
| AD9 | Sessions has no left-rail entry. The right side is where it lives, the header's Assistant control is the one door, and a stale `?panel=sessions` link opens the assistant instead. A panel on the right whose collapse control folded the left column was the proof it was still keyed to the wrong side. |
| AD10 | **The attachment chip belongs to the composer, not to a wrapper around the panel.** AD2 says it rides above the composer; a shell that renders it above the *whole panel* pins it to the top of the region, a list's length away from the ask it qualifies. `SessionComposer` owns it, and the assistant has no shell component of its own — the occupant of `rightSection` is `AssistantViewPanel` itself. |
| AD19 | **An ask that omits `lens_id` runs in the session's world; one that sends `null` runs in *Everything* for that ask only.** Set-ness, not None-ness, on `SendMessage` and on `PATCH …/sessions/{id}` alike: null is a world somebody chose, and *Next ask only* has to be able to choose it. |
| AD20 | **`sessions.lens_id` has no foreign key.** A deleted world leaves its id behind, so the summary answers `lens_missing` and the chip says the world is gone, while the next ask runs in *Everything*. A `SET NULL` would make *deleted* and *never picked* look alike. A turn's world name is read from its run's frozen contributors, so it survives the delete too. |
| AD21 | **The tokens per run are clamped on write and frozen on the run.** `PATCH` stores `min(asked, agent's max_tokens_run)`; `open_turn` freezes the same `min` into `task_runs.params.max_tokens_run`. The summary carries `agent_max_tokens_run` so the settings popover can say the value was clamped. `max_cost_usd_run` is still accepted and answered for one release and bounds nothing ([EB8](../../agents/features/envelope-and-budget.md#decisions)). |

## Where the code lives

| | |
|---|---|
| Studio | `studio/packages/assistant/src/` (`@invana-studio/assistant`) — `AssistantViewPanel` and its `Session*` parts, `AssistantStart`, `AssistantReopenPill`, and the console |
| The region | `src/pages/graphs-detail/shared/useRightSection.ts` — who holds `rightSection`, which is the region's question, not the assistant's |
| Siblings | `features/ask/answer-surface/` (what a reply renders) and `features/ask/projections/` (the Templates panel). One module, one sub-folder per feature |
| Not | `features/explore/` — it was there, and that was the filing mistake AD12 names |
