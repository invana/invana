/**
 * Hiding things on the open canvas.
 *
 * TODO(canvas-visibility): delete this module once `@invana/canvas` owns the
 * cascade — replace callers with `layer.hideNode(id)` / `showNode(id)`, and swap
 * `isNodeHidden` here for the layer's own.
 * See docs/for-developers/modules/explore/spec.md § What this module owns.
 *
 * Two panels hide things — the Layers tree, one element at a time, and the
 * Explorer panel's type rows, a whole type at a time
 * (selection-and-the-panel.md SP7). One mechanism serves both, so the pending
 * canvas-API cleanup lands in one place and the two never disagree about what
 * "hidden" means.
 */

import { HIDDEN_STATE_NAME } from "@/pages/graphs-detail/features/explorer/ExplorerCanvas";
import type { GraphStore } from "@invana/graph";

/** Is this node currently hidden on the canvas? */
export function isNodeHidden(store: GraphStore, id: string): boolean {
	return store.hasNodeState(id, HIDDEN_STATE_NAME);
}

/**
 * Hide/show a single node by toggling the sticky `hidden` overlay (registered on
 * the layer in ExplorerCanvas). Incident edges follow so nothing dangles to an
 * invisible endpoint; on show, an edge only reappears if its other end is
 * visible. One batch → one flush → one paint.
 */
export function setNodeHidden(
	store: GraphStore,
	id: string,
	hidden: boolean,
): void {
	store.batch(() => {
		store.setNodeState(id, HIDDEN_STATE_NAME, hidden);
		for (const e of store.edgesOf(id, "both")) {
			if (hidden) {
				store.setEdgeState(e.id, HIDDEN_STATE_NAME, true);
			} else {
				const other = e.source === id ? e.target : e.source;
				if (!store.hasNodeState(other, HIDDEN_STATE_NAME)) {
					store.setEdgeState(e.id, HIDDEN_STATE_NAME, false);
				}
			}
		}
	});
}

/**
 * Hide/show every node of one type, in one batch.
 *
 * A type row's eye is a canvas control, not a query (SP7): nothing re-runs, and
 * the graph-wide count on the row does not move — only the footer's totals,
 * which count what is shown.
 */
export function setNodeTypeHidden(
	store: GraphStore,
	type: string,
	hidden: boolean,
): void {
	store.batch(() => {
		for (const node of store.nodes()) {
			if (node.type !== type) continue;
			setNodeHidden(store, String(node.id), hidden);
		}
	});
}

/** Which node types are currently hidden on the canvas, wholly or in part. */
export function hiddenNodeTypes(store: GraphStore): Set<string> {
	const hidden = new Set<string>();
	for (const node of store.nodes()) {
		if (node.type && isNodeHidden(store, String(node.id)))
			hidden.add(node.type);
	}
	return hidden;
}
