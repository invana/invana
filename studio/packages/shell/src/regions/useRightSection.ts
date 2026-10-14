/**
 * Who holds `rightSection` — the one owner of the page's right side.
 *
 * **One param per region, and its value is the occupant**
 * (docs/for-developers/building-studio/graph-detail-page.md). `?right=` *is*
 * the occupant, absent *is* closed, and another occupant would be one more
 * value rather than one more flag. Today there is one: the assistant. A record
 * opened on a board is a card on the board, not a right-side panel, so it
 * never takes the side from the conversation.
 */

import { useUpdateSearchParams } from "@invana-studio/core";
import { useCallback } from "react";
import { useSearchParams } from "react-router-dom";

/** The occupants. Adding one is a value here and an entry in the page's registry. */
export type RightSectionKey = "assistant";

const RIGHT_PARAM = "right";

// The param is user-controlled, so a stale or hand-typed value falls back to
// "closed" rather than indexing the registry with undefined.
const KNOWN_KEYS: readonly RightSectionKey[] = ["assistant"];

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
	const [params] = useSearchParams();
	const update = useUpdateSearchParams();
	const raw = params.get(RIGHT_PARAM);
	const key = KNOWN_KEYS.includes(raw as RightSectionKey)
		? (raw as RightSectionKey)
		: null;

	// Through the composing writer, so a param another region writes in the
	// same beat (`?console=`) survives this one.
	const write = useCallback(
		(next: RightSectionKey | null) =>
			update((search) => {
				if (next === null) search.delete(RIGHT_PARAM);
				else search.set(RIGHT_PARAM, next);
				return search;
			}),
		[update],
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
