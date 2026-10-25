/**
 * The run's ledger, as the **kit's** `gantt` block reads it — a row per layer,
 * opening into its participants, a bar per touch.
 *
 * *As someone reading an answer I am about to act on, I want to see which
 * participants each step engaged and which ones it was refused, in the order it
 * happened, so that "what grounded this" is a drawing rather than a log I
 * reconstruct.*
 *
 * **This file composes; it does not render.** `@invana/blocks` ships the
 * `gantt` block, so Studio's job is the one thing the kit cannot know: how a
 * `TouchesResponse` and a trace become rows and bars. A renderer here would be a second drawing of the same
 * data, which is what [design-system.md](../../../../../docs/for-developers/modules/platform/features/design-system.md)
 * exists to stop.
 *
 * Three things here are the design:
 *
 * - **A refusal is struck in place, never filtered out.** It keeps its position
 *   on the axis, so a gap still means *nothing reached for this layer here* and
 *   cannot be mistaken for a denial. That is the kit's own behaviour
 *   ([governance.md](../../../../../docs/for-developers/governance.md)); this file's part
 *   is to pass refusals through rather than dropping them on the way in.
 * - **A layer nothing touched is muted, never dropped**
 *   ([governance.md](../../../../../docs/for-developers/governance.md)). All six layer
 *   rows are always passed, because *the run never went near a third party* and
 *   *this surface does not show third parties* are different facts about a run.
 * - **The axis is the trace's clock, or it is the ledger's order — never a
 *   guess between them.** A touch has a `seq` and a duration but no start of
 *   its own, so its bar is the window of the **step** it belongs to, read off
 *   `GET …/runs/{id}/trace`. If any touch cannot be placed on that clock the
 *   whole gantt falls back to `seq`, because a drawing half on a wall clock and
 *   half on an ordinal is a drawing that lies about both
 *   ([design-system.md](../../../../../docs/for-developers/modules/platform/features/design-system.md)).
 *
 * The spine is a row like the rest: `agent` is the runtime doing the
 * participating rather than being a participant.
 */

import type { Layer } from "@invana/ui";
import type { Touch } from "@invana-studio/core";

/** Every layer, spine last — the order the rows are read in. */
export const BANDS: Layer[] = [
	"graph_data",
	"llm",
	"third_party",
	"cache",
	"human",
	"agent",
];

/** How a touch's direction reads under its bar. */
const DIRECTION_LABEL: Record<Touch["direction"], string> = {
	in: "read",
	out: "sent",
	refused: "refused",
	skipped: "skipped",
};

/** `read` · `sent` · `refused` — a touch's direction, in the reader's words. */
export function directionLabel(direction: Touch["direction"]): string {
	return DIRECTION_LABEL[direction];
}
