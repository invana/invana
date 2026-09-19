import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";

// A **stacked panel** says which drawer holds the column's height through
// `?drawer=`, and what is drilled into through one key per record
// (graph-detail-page.md G31 · G33).
//
// Two panels are stacks today — **Library** (Plans · Catalogue · Templates) and
// **Projects** (Projects · Todos) — and they share this hook rather than one
// each, so the param vocabulary is described once. **Runs is not one of them**:
// it is a list, so it carries `&run=` and no `?drawer=` (G33). Only one panel is
// open at a time (`?panel=` is single-open), so `?drawer=` never has two owners;
// the per-record keys are named for the record rather than for the drawer, so a
// link says what it opens.
//
// Every key here is dropped when `?panel=` moves to another section, in
// `useSettingsPanel` — a run left in the URL under a different rail icon names
// a drawer that is not on screen.

const DRAWER_PARAM = "drawer";

export interface DrawerStackSpec<D extends string> {
	/** The drawers, in the order they are stacked. The first one is the default. */
	drawers: readonly D[];
	/** The `?` key each drawer drills in with — `plans` → `plan`, `todos` → `todo`. */
	detailParam: Record<D, string>;
}

export interface DrawerStack<D extends string> {
	/** Which drawer holds the height. */
	drawer: D;
	/** What each drawer is drilled into, or null. */
	detail: Record<D, string | null>;
	/** Give a drawer the height without drilling into anything. */
	focus: (d: D) => void;
	/** Drill in (or back out, with `null`), which also focuses that drawer. */
	open: (d: D, value: string | null) => void;
}

export function useDrawerStack<D extends string>({
	drawers,
	detailParam,
}: DrawerStackSpec<D>): DrawerStack<D> {
	const [params, setParams] = useSearchParams();

	const raw = params.get(DRAWER_PARAM);
	// The first drawer leads: in a stack each drawer is the definition of the one
	// above it, so the top one is the question a person arrives with (§3a).
	const drawer = drawers.includes(raw as D) ? (raw as D) : drawers[0];

	const detail = useMemo(() => {
		const out = {} as Record<D, string | null>;
		for (const d of drawers) out[d] = params.get(detailParam[d]);
		return out;
		// `params` is a fresh object each render; its string form is the identity
		// that matters.
	}, [params, drawers, detailParam]);

	// `focus` and `open` take the functional form of `setParams` so they are
	// **stable across renders**: they are handed to drawer bodies as callbacks,
	// and a writer that changed identity every render would make every effect
	// that depends on one re-fire on every keystroke.
	const focus = useCallback(
		(d: D) => {
			setParams(
				(prev) => {
					const next = new URLSearchParams(prev);
					next.set(DRAWER_PARAM, d);
					return next;
				},
				{ replace: true },
			);
		},
		[setParams],
	);

	// Drilling in focuses the drawer it happened in: the detail replaces that
	// drawer's body, so the drawer needs the height to show it. The other
	// drawers keep their place, which is the thing the stack buys (G33).
	const open = useCallback(
		(d: D, value: string | null) => {
			setParams(
				(prev) => {
					const next = new URLSearchParams(prev);
					next.set(DRAWER_PARAM, d);
					if (value) next.set(detailParam[d], value);
					else next.delete(detailParam[d]);
					return next;
				},
				{ replace: true },
			);
		},
		[setParams, detailParam],
	);

	return useMemo(
		() => ({ drawer, detail, focus, open }),
		[drawer, detail, focus, open],
	);
}
