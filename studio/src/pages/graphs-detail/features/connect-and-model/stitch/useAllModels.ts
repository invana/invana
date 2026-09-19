/**
 * The all models fan-out (stitch-models.md ST16).
 *
 * One read of the models list, one of each model's **active version**, one of
 * `…/model-links` — and nothing of `…/global-model`, whose `GlobalType` carries
 * no endpoints. Everything the canvas needs to draw a crossing is already on
 * these payloads: an edge type names its source and target types, a link names
 * both versions and both types. So the drawn surface needs no engine change,
 * and ST6 stands — the global-model *page* is still stated, not drawn.
 *
 * The **introspected** model is excluded. The physical mirror is what the
 * database happens to hold, not a domain anyone authored, and drawing it beside
 * the models would put a territory on the canvas nobody can stitch (spec.md §2).
 */

import { useModelLinksQuery, useModelsQuery } from "@/hooks/queries/useModels";
import {
	type ModelFrame,
	hueForIndex,
} from "@/pages/graphs-detail/features/connect-and-model/stitch/allModels";
import { modelsApi } from "@/services/api/models";
import type { ModelLink } from "@/types/models";
import { useQueries } from "@tanstack/react-query";
import { useMemo } from "react";

export interface AllModelsResult {
	frames: ModelFrame[];
	links: ModelLink[];
	/** Models that exist but have never published — drawn as empty frames (ST18). */
	unpublished: number;
	isLoading: boolean;
	isError: boolean;
	error: unknown;
}

/**
 * `?? []` hands back a *new* array on every render, and the canvas keys its data
 * build on this reference — `<GraphLayer data>` replaces the drawing when it
 * flips, and the engine re-runs the layout when the drawing changes. One frozen
 * empty instead, as `SchemaCanvas` does for the same reason.
 */
const NO_LINKS: ModelLink[] = [];

export function useAllModels(
	username?: string,
	graphSlug?: string,
): AllModelsResult {
	const models = useModelsQuery(username, graphSlug);
	const links = useModelLinksQuery(username, graphSlug);

	// Authored domains only. Order is the list's order, so a model keeps its hue
	// across a refetch — a colour that moves is a colour that means nothing (ST17).
	const domains = useMemo(
		() => (models.data ?? []).filter((m) => m.origin !== "introspected"),
		[models.data],
	);

	/**
	 * `combine` is not a convenience here, it is the fix. `useQueries` hands back
	 * a **new results array on every render**, and the canvas keys its data build
	 * on what this hook returns — so the drawing was rebuilt (and `<GraphLayer
	 * data>` *replaces* rather than patches) dozens of times a second, taking
	 * every frame's collapsed state with it each time (ST31). A combined result
	 * is structurally shared, so it keeps its identity until a version actually
	 * changes.
	 */
	const versions = useQueries({
		queries: domains
			.filter((m) => m.active_version)
			.map((model) => ({
				queryKey: ["models", username, graphSlug, model.id, "active-version"],
				queryFn: () =>
					modelsApi.getActiveVersion(
						username as string,
						graphSlug as string,
						model.id,
					),
			})),
		combine: (results) => ({
			data: results.map((r) => r.data),
			isLoading: results.some((r) => r.isLoading),
			error: results.find((r) => r.isError)?.error,
		}),
	});

	// `useQueries` is indexed by the *published* subset, so the two lists are
	// walked with their own cursor rather than a shared index.
	const frames = useMemo(() => {
		let cursor = 0;
		return domains.map((model, i): ModelFrame => {
			const hue = hueForIndex(i);
			if (!model.active_version) {
				return {
					modelId: model.id,
					name: model.name,
					description: model.description,
					versionId: null,
					versionLabel: null,
					hue,
					nodeTypes: [],
					edgeTypes: [],
				};
			}
			const version = versions.data[cursor];
			cursor += 1;
			return {
				modelId: model.id,
				name: model.name,
				description: model.description,
				versionId: model.active_version.id,
				versionLabel: model.active_version.version,
				hue,
				nodeTypes: version?.node_types ?? [],
				edgeTypes: version?.edge_types ?? [],
			};
		});
	}, [domains, versions.data]);

	const versionsLoading = versions.isLoading;
	const versionsError = versions.error;

	return {
		frames,
		links: links.data ?? NO_LINKS,
		unpublished: domains.filter((m) => !m.active_version).length,
		isLoading: models.isLoading || links.isLoading || versionsLoading,
		isError: models.isError || links.isError || !!versionsError,
		error: models.error ?? links.error ?? versionsError,
	};
}
