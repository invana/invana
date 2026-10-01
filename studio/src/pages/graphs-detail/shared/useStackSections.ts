import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";

// A **stacked panel** says which section holds the column's height through
// `?section=`, and what is drilled into through one key per record
// (graph-detail-page.md).
//
// Two panels are stacks today — **Library** (Plans · Catalogue · Templates) and
// **Projects** (Projects · Todos) — and they share this hook rather than one
// each, so the param vocabulary is described once. **Runs is not one of them**:
// it is a list, so it carries `&run=` and no `?section=`. Only one panel is
// open at a time (`?panel=` is single-open), so `?section=` never has two owners;
// the per-record keys are named for the record rather than for the section, so a
// link says what it opens.
//
// Every key here is dropped when `?panel=` moves to another section, in
// `useLeftSection` — a run left in the URL under a different rail icon names
// a section that is not on screen.

export const SECTION_PARAM = "section";
// The key's other spelling: still **read**, so an older link opens its section;
// never written, and dropped on every write.
export const LEGACY_SECTION_PARAM = "drawer";

/** The section a URL opens on: `?section=`, else `?section=`, else the first one. */
export function sectionOf<D extends string>(
	params: URLSearchParams,
	sections: readonly D[],
): D {
	const raw = params.get(SECTION_PARAM) ?? params.get(LEGACY_SECTION_PARAM);
	return sections.includes(raw as D) ? (raw as D) : sections[0];
}

/** A copy of `params` focused on section `d`, spelled `?section=` only. */
export function withSection(
	params: URLSearchParams,
	d: string,
): URLSearchParams {
	const next = new URLSearchParams(params);
	next.set(SECTION_PARAM, d);
	next.delete(LEGACY_SECTION_PARAM);
	return next;
}

export interface StackSectionsSpec<D extends string> {
	/** The sections, in the order they are stacked. The first one is the default. */
	sectionKeys: readonly D[];
	/** The `?` key each section drills in with — `plans` → `plan`, `todos` → `todo`. */
	detailParam: Record<D, string>;
}

export interface StackSections<D extends string> {
	/** Which section holds the height. */
	sectionKey: D;
	/** What each section is drilled into, or null. */
	detail: Record<D, string | null>;
	/** Give a section the height without drilling into anything. */
	focus: (d: D) => void;
	/** Drill in (or back out, with `null`), which also focuses that section. */
	open: (d: D, value: string | null) => void;
}

export function useStackSections<D extends string>({
	sectionKeys,
	detailParam,
}: StackSectionsSpec<D>): StackSections<D> {
	const [params, setParams] = useSearchParams();

	// The first section leads: in a stack each section is the definition of the one
	// above it, so the top one is the question a person arrives with (§3a).
	const sectionKey = sectionOf(params, sectionKeys);

	const detail = useMemo(() => {
		const out = {} as Record<D, string | null>;
		for (const d of sectionKeys) out[d] = params.get(detailParam[d]);
		return out;
		// `params` is a fresh object each render; its string form is the identity
		// that matters.
	}, [params, sectionKeys, detailParam]);

	// `focus` and `open` take the functional form of `setParams` so they are
	// **stable across renders**: they are handed to section bodies as callbacks,
	// and a writer that changed identity every render would make every effect
	// that depends on one re-fire on every keystroke.
	const focus = useCallback(
		(d: D) => {
			setParams((prev) => withSection(prev, d), { replace: true });
		},
		[setParams],
	);

	// Drilling in focuses the section it happened in: the detail replaces that
	// section's body, so the section needs the height to show it. The other
	// sections keep their place, which is the thing the stack buys.
	const open = useCallback(
		(d: D, value: string | null) => {
			setParams(
				(prev) => {
					const next = withSection(prev, d);
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
		() => ({ sectionKey, detail, focus, open }),
		[sectionKey, detail, focus, open],
	);
}
