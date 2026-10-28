/**
 * The model page's reading, in the URL (the-model-page.md).
 *
 * Scope and panel are one state: `&model=` is the scope the page reads *and*
 * the model whose outline the leftSection holds, and `&model_open=1` is that
 * outline open. The tab and the window ride beside them, so a reload lands on
 * the same reading. Absent means the default — `All models`, Overview, 30
 * days — so a bare link to the page is the landscape.
 *
 * Inside one model, two readings replace the tabs: `&models_view=schema` is
 * the model's canvas full-bleed (*Open in Schema*), and `&model_type=<name>`
 * is one type's page, on its own tab (`&type_tab=`). Both belong to the scope
 * and are cleared with it.
 */

import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";

export const MODELS_TABS = [
	"overview",
	"database",
	"usage",
	"performance",
	"growth",
	"history",
] as const;
export type ModelsTab = (typeof MODELS_TABS)[number];

export const MODELS_WINDOWS = ["7d", "30d", "90d"] as const;
export type ModelsWindow = (typeof MODELS_WINDOWS)[number];

export const TYPE_TABS = [
	"properties",
	"indexes",
	"constraints",
	"mappings",
] as const;
export type TypeTab = (typeof TYPE_TABS)[number];

const SCOPE = "model";
const OPEN = "model_open";
const TAB = "models_tab";
const WINDOW = "models_window";
const VIEW = "models_view";
const TYPE = "model_type";
const TYPE_TAB = "type_tab";

export interface ModelsView {
	/** The model the page reads, or `null` for All models. */
	scope: string | null;
	/** The leftSection holds {@link scope}'s outline. */
	open: boolean;
	tab: ModelsTab;
	window: ModelsWindow;
	/** The scope's canvas, full-bleed, in place of the tabs. */
	schema: boolean;
	/** The type page open inside the scope, by type name. */
	type: string | null;
	typeTab: TypeTab;
}

/**
 * The link to one model's page — or its type page, or its schema canvas —
 * from another Modeller page. Landing on `/modeller/models` brings the models
 * board forward, and the outline opens beside it.
 */
export function modelPagePath(
	username: string,
	graphSlug: string,
	modelId: string,
	at: { type?: string; schema?: boolean } = {},
): string {
	const q = new URLSearchParams({ [SCOPE]: modelId, [OPEN]: "1" });
	if (at.type) q.set(TYPE, at.type);
	if (at.schema) q.set(VIEW, "schema");
	return `/u/${username}/${graphSlug}/modeller/models?${q}`;
}

export function useModelsView() {
	const [params, setParams] = useSearchParams();

	const view = useMemo((): ModelsView => {
		const tab = params.get(TAB) as ModelsTab | null;
		const window = params.get(WINDOW) as ModelsWindow | null;
		const typeTab = params.get(TYPE_TAB) as TypeTab | null;
		const scope = params.get(SCOPE);
		return {
			scope,
			open: !!scope && params.get(OPEN) === "1",
			// The params are user-controlled; a stale value reads as the default.
			tab: tab && MODELS_TABS.includes(tab) ? tab : "overview",
			window: window && MODELS_WINDOWS.includes(window) ? window : "30d",
			schema: !!scope && params.get(VIEW) === "schema",
			type: scope ? params.get(TYPE) : null,
			typeTab: typeTab && TYPE_TABS.includes(typeTab) ? typeTab : "properties",
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
					if ("schema" in patch) write(VIEW, patch.schema ? "schema" : null);
					if ("type" in patch) write(TYPE, patch.type ?? null);
					if ("typeTab" in patch)
						write(
							TYPE_TAB,
							patch.typeTab === "properties" ? null : (patch.typeTab ?? null),
						);
					for (const [key, value] of Object.entries(extra ?? {}))
						write(key, value);
					// Nothing is drilled into without a scope.
					if (!next.get(SCOPE))
						for (const key of [OPEN, VIEW, TYPE, TYPE_TAB]) next.delete(key);
					return next;
				},
				{ replace: true },
			);
		},
		[setParams],
	);

	return { view, set };
}
