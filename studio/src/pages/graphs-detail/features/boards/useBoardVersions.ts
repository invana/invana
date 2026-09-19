/**
 * Board contents, keyed by canvas.
 *
 * The Explorer used to hold one canvas's worth of state — contents, seed,
 * styling, selection, the elements the graph no longer holds — in five
 * `useState`s at page level, while hosting many canvases. Switching a tab
 * therefore had to *repaint* the one canvas: an API round-trip, a destructive
 * re-seed, and every position lost.
 *
 * Here each canvas has its own slice. Nothing else changes yet: the hook hands
 * back the same five values and the same five setters, resolved against
 * whichever canvas is active, so every caller reads exactly as it did. What it
 * buys is that a second canvas can now hold its own contents at the same time —
 * which is what a page host needs before it can mount more than one
 * (`docs/for-developers/building-studio/the-shell.md`).
 *
 * **The draft key.** A query can paint before its canvas row exists — a first
 * question in a new session answers, and only then is a canvas created. That
 * paint lands under `DRAFT`, and is adopted under the real id the moment one
 * appears, so nothing is lost in the gap.
 */

import type { CanvasStyling } from "@/types/board";
import type { QueryResultItem } from "@/types/query";
import type { GraphData } from "@invana/graph";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export interface BoardSlice {
	/** Everything drawn on this canvas. A query replaces it; an expand appends. */
	items: QueryResultItem[];
	/** What `<GraphLayer data>` is seeded with — changes only on a full repaint. */
	seed: GraphData;
	/** Per node/edge-type visual rules. */
	styling: CanvasStyling;
	/** The node or edge the inspector is reading. */
	selectedId: string | null;
	/** Drawn, but no longer in the graph (GC5). */
	missingIds: Set<string>;
}

const EMPTY_SLICE: BoardSlice = {
	items: [],
	seed: { nodes: [], edges: [] },
	styling: {},
	selectedId: null,
	missingIds: new Set(),
};

/** Where a paint lands while its canvas does not exist yet. */
const DRAFT = "__draft__";

type Update<T> = T | ((prev: T) => T);

function resolve<T>(next: Update<T>, prev: T): T {
	return typeof next === "function" ? (next as (p: T) => T)(prev) : next;
}

export function useBoardVersions(activeCanvasId: string | null) {
	const [byId, setById] = useState<Record<string, BoardSlice>>({});
	const key = activeCanvasId ?? DRAFT;

	// The setters below must be **stable**, because they replace `useState`
	// setters at ~30 call sites that pass them into `useCallback` deps and
	// effects. A setter that changed identity whenever the active canvas changed
	// would re-create every one of those. So the key is read through a ref at
	// call time rather than closed over.
	const keyRef = useRef(key);
	keyRef.current = key;

	const patch = useCallback(
		(k: string, f: (prev: BoardSlice) => Partial<BoardSlice>) =>
			setById((prev) => {
				const before = prev[k] ?? EMPTY_SLICE;
				return { ...prev, [k]: { ...before, ...f(before) } };
			}),
		[],
	);

	// A canvas row appeared for what was painted as a draft — adopt it, so the
	// first answer in a new session is not lost when its canvas is created.
	const adoptedFor = useRef<string | null>(null);
	useEffect(() => {
		if (!activeCanvasId || adoptedFor.current === activeCanvasId) return;
		adoptedFor.current = activeCanvasId;
		setById((prev) => {
			const draft = prev[DRAFT];
			if (!draft || draft.items.length === 0) return prev;
			if (prev[activeCanvasId]?.items.length) return prev;
			const { [DRAFT]: _, ...rest } = prev;
			return { ...rest, [activeCanvasId]: draft };
		});
	}, [activeCanvasId]);

	const slice = byId[key] ?? EMPTY_SLICE;

	// The same five setters the page has always called, bound to the active
	// canvas. Keeping the shape identical is the point: this is a change of
	// *where* the state lives, not of who writes it.
	const setItems = useCallback(
		(next: Update<QueryResultItem[]>) =>
			patch(keyRef.current, (p) => ({ items: resolve(next, p.items) })),
		[patch],
	);
	const setSeed = useCallback(
		(next: Update<GraphData>) =>
			patch(keyRef.current, (p) => ({ seed: resolve(next, p.seed) })),
		[patch],
	);
	const setStyling = useCallback(
		(next: Update<CanvasStyling>) =>
			patch(keyRef.current, (p) => ({ styling: resolve(next, p.styling) })),
		[patch],
	);
	const setSelectedId = useCallback(
		(next: Update<string | null>) =>
			patch(keyRef.current, (p) => ({
				selectedId: resolve(next, p.selectedId),
			})),
		[patch],
	);
	const setMissingIds = useCallback(
		(next: Update<Set<string>>) =>
			patch(keyRef.current, (p) => ({
				missingIds: resolve(next, p.missingIds),
			})),
		[patch],
	);

	/** Read another canvas's slice — what a second mounted page will need. */
	const sliceFor = useCallback(
		(boardId: string): BoardSlice => byId[boardId] ?? EMPTY_SLICE,
		[byId],
	);

	/** Forget a canvas that was closed. */
	const forget = useCallback((boardId: string) => {
		setById((prev) => {
			if (!(boardId in prev)) return prev;
			const { [boardId]: _, ...rest } = prev;
			return rest;
		});
	}, []);

	return useMemo(
		() => ({
			items: slice.items,
			seed: slice.seed,
			styling: slice.styling,
			selectedId: slice.selectedId,
			missingIds: slice.missingIds,
			setItems,
			setSeed,
			setStyling,
			setSelectedId,
			setMissingIds,
			sliceFor,
			forget,
		}),
		[
			slice,
			setItems,
			setSeed,
			setStyling,
			setSelectedId,
			setMissingIds,
			sliceFor,
			forget,
		],
	);
}
