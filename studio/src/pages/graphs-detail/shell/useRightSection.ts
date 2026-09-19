/**
 * Who holds `rightSection` — the one owner of the page's right side.
 *
 * **One param per region, and its value is the occupant**
 * (docs/for-developers/building-studio/graph-detail-page.md G16). The right side
 * used to have two occupants and two mechanisms: `?ai=1` opened the assistant,
 * a component-local `inspectorClosed` opened the inspector, and nothing said
 * which of them was on screen — the inspector did not even survive a reload.
 *
 * `?right=` settles it. The value *is* the occupant, absent *is* closed, and a
 * third occupant is one more value rather than one more flag.
 *
 * Opening one replaces the other, and closing closes the region: the right side
 * keeps no memory of what was there before (the-assistant.md AD11).
 * Restoring a previous occupant needs a second piece of state to hold it, which
 * is the thing this param exists to remove.
 */

import { useCallback } from "react";
import { useSearchParams } from "react-router-dom";

/** The occupants. Adding one is a value here and an entry in the page's registry. */
export type RightSectionKey = "assistant" | "inspector";

const RIGHT_PARAM = "right";

// Read once, normalised away on the next write — the same one-way alias shape
// `useSettingsPanel` applies to `?settings=`. `?ai=` carried the assistant as a
// boolean (and, in dead code, a session id); `?inspector=open` carried the
// inspector. Neither is ever written again.
const LEGACY_ASSISTANT_PARAM = "ai";
const LEGACY_INSPECTOR_PARAM = "inspector";

// The param is user-controlled, so a stale or hand-typed value falls back to
// "closed" rather than indexing the registry with undefined.
const KNOWN_KEYS: readonly RightSectionKey[] = ["assistant", "inspector"];

/** The assistant wins when a legacy URL names both — it did before too. */
function readLegacy(params: URLSearchParams): RightSectionKey | null {
	if (params.get(LEGACY_ASSISTANT_PARAM) !== null) return "assistant";
	if (params.get(LEGACY_INSPECTOR_PARAM) === "open") return "inspector";
	return null;
}

export interface RightSection {
	/** The occupant on screen, or null when the region is closed. */
	key: RightSectionKey | null;
	isOpen: boolean;
	is: (key: RightSectionKey) => boolean;
	open: (key: RightSectionKey) => void;
	close: () => void;
	/** Open it, or close the region if it is already the occupant. */
	toggle: (key: RightSectionKey) => void;
}

export function useRightSection(): RightSection {
	const [params, setParams] = useSearchParams();
	const raw = params.get(RIGHT_PARAM);
	const key = KNOWN_KEYS.includes(raw as RightSectionKey)
		? (raw as RightSectionKey)
		: raw === null
			? readLegacy(params)
			: null;

	const write = useCallback(
		(next: RightSectionKey | null) => {
			const search = new URLSearchParams(params);
			if (next === null) search.delete(RIGHT_PARAM);
			else search.set(RIGHT_PARAM, next);
			// Every write drops the legacy keys, so two params can never disagree
			// about which occupant is on screen.
			search.delete(LEGACY_ASSISTANT_PARAM);
			search.delete(LEGACY_INSPECTOR_PARAM);
			setParams(search, { replace: true });
		},
		[params, setParams],
	);

	return {
		key,
		isOpen: key !== null,
		is: useCallback((k: RightSectionKey) => k === key, [key]),
		open: write,
		close: useCallback(() => write(null), [write]),
		toggle: useCallback(
			(k: RightSectionKey) => write(k === key ? null : k),
			[key, write],
		),
	};
}
