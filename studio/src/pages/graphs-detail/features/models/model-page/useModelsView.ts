/**
 * The model page's reading, in the URL (the-model-page.md MP5 · MP23).
 *
 * Scope and panel are one state: `&model=` is the scope the page reads *and*
 * the row the panel has selected, and `&model_open=1` is the panel drilled into
 * it. The tab and the window ride beside them, so a reload lands on the same
 * reading. Absent means the default — `All models`, Overview, 30 days — so a
 * bare link to the page is the landscape.
 */

import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";

export const MODELS_TABS = [
	"overview",
	"model",
	"database",
	"usage",
	"performance",
	"growth",
] as const;
export type ModelsTab = (typeof MODELS_TABS)[number];

export const MODELS_WINDOWS = ["7d", "30d", "90d"] as const;
export type ModelsWindow = (typeof MODELS_WINDOWS)[number];

const SCOPE = "model";
const OPEN = "model_open";
const TAB = "models_tab";
const WINDOW = "models_window";

export interface ModelsView {
	/** The model the page reads, or `null` for All models. */
	scope: string | null;
	/** The panel is drilled into {@link scope}'s drawers. */
	open: boolean;
	tab: ModelsTab;
	window: ModelsWindow;
}

export function useModelsView() {
	const [params, setParams] = useSearchParams();

	const view = useMemo((): ModelsView => {
		const tab = params.get(TAB) as ModelsTab | null;
		const window = params.get(WINDOW) as ModelsWindow | null;
		const scope = params.get(SCOPE);
		return {
			scope,
			open: !!scope && params.get(OPEN) === "1",
			// The params are user-controlled; a stale value reads as the default.
			tab: tab && MODELS_TABS.includes(tab) ? tab : "overview",
			window: window && MODELS_WINDOWS.includes(window) ? window : "30d",
		};
	}, [params]);

	/**
	 * Write the reading. `extra` writes other keys in the same update — `page`
	 * when the panel brings the board forward, `panel` when the page opens the
	 * panel — because two writes in one tick do not compose (useBoardPage).
	 */
	const set = useCallback(
		(patch: Partial<ModelsView>, extra?: Record<string, string | null>) => {
			setParams(
				(prev) => {
					const next = new URLSearchParams(prev);
					const write = (key: string, value: string | null) => {
						if (value) next.set(key, value);
						else next.delete(key);
					};
					if ("scope" in patch) write(SCOPE, patch.scope ?? null);
					if ("open" in patch) write(OPEN, patch.open ? "1" : null);
					if ("tab" in patch)
						write(TAB, patch.tab === "overview" ? null : (patch.tab ?? null));
					if ("window" in patch)
						write(
							WINDOW,
							patch.window === "30d" ? null : (patch.window ?? null),
						);
					for (const [key, value] of Object.entries(extra ?? {}))
						write(key, value);
					// Nothing is drilled into without a scope.
					if (!next.get(SCOPE)) next.delete(OPEN);
					return next;
				},
				{ replace: true },
			);
		},
		[setParams],
	);

	return { view, set };
}
