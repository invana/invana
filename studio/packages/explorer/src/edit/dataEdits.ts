/**
 * A board's unsaved changes saved to the graph (4.7 Edit the graph's data).
 *
 * The batching — the tracker's net change as an ordered list of edits, and the
 * database's ids put in place after — is `@invana/graph`'s (`unsavedToEditOps`,
 * `adoptBackendIds`, `saveUnsaved`). What is Studio's is where the batch goes,
 * `POST …/data-edits`, and the keys it never sends: the `_inv_*` provenance the
 * engine owns.
 */
import type { Canvas } from "@invana/canvas";
import { type EditOp, saveUnsaved } from "@invana/graph";
import { explorerApi } from "../api";
import { isProvenanceKey } from "../ProvenanceBlock";

/** One edit the engine's `POST …/data-edits` applies. */
export type DataEdit = EditOp;

/** What the engine answers a save with. */
export interface DataEditResult {
	run_id: string;
	/** Each new element's database id, by its board id. */
	ids: Record<string, string>;
	applied: number;
}

/**
 * Save the board's unsaved changes to the graph — the Changes panel's
 * `onSave`. One batch, checked against `modelVersionId` when given; a refusal
 * throws and every change stays.
 */
export function saveBoardChanges(
	canvas: Canvas,
	target: { username: string; graphSlug: string; modelVersionId?: string },
): Promise<void> {
	return saveUnsaved(
		canvas,
		(edits) =>
			explorerApi.saveDataEdits(
				target.username,
				target.graphSlug,
				edits,
				target.modelVersionId,
			),
		{ hidden: isProvenanceKey },
	);
}
