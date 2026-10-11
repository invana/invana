/**
 * Operate's spec icons — the shared map, re-exported.
 *
 * It moved to `shared/boardIcons.ts` when Skills began composing boards of
 * its own: a second map is a second vocabulary for one `icon: "file"`
 * ([code-shape §4.1](../../../../../../docs/for-developers/building-studio/code-shape.md)).
 * This file stays so a run composer's import does not have to know that.
 */

export { BOARD_ICONS } from "@/pages/graphs-detail/shared/boardIcons";
