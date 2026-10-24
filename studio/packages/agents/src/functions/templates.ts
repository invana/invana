/**
 * Answer templates — the reads and writes Functions › Templates and a
 * template's page share. Keys are `["projection-templates", owner, graph]`,
 * so authoring, publishing or removing one re-reads both.
 *
 * The engine returns a Graph's templates whole — the ones it authored and the
 * ones that ship with Invana — so the tab holds every row on screen.
 */

import { projectionTemplatesApi } from "@invana-studio/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

/** The surfaces a result template renders to. */
export const RESULT_SURFACES = [
	"table",
	"metric",
	"chart",
	"subgraph",
	"markdown",
] as const;

const templatesKey = (username: string, graphSlug: string) =>
	["projection-templates", username, graphSlug] as const;

export function useTemplatesQuery(username: string, graphSlug: string) {
	return useQuery({
		queryKey: templatesKey(username, graphSlug),
		queryFn: () => projectionTemplatesApi.list(username, graphSlug),
	});
}

/** Publish, remove and author — each re-reads the Graph's templates. */
export function useTemplateMutations(username: string, graphSlug: string) {
	const qc = useQueryClient();
	const invalidate = () =>
		qc.invalidateQueries({ queryKey: templatesKey(username, graphSlug) });
	const publish = useMutation({
		mutationFn: (id: string) =>
			projectionTemplatesApi.publish(username, graphSlug, id),
		onSuccess: invalidate,
	});
	const remove = useMutation({
		mutationFn: (id: string) =>
			projectionTemplatesApi.remove(username, graphSlug, id),
		onSuccess: invalidate,
	});
	const create = useMutation({
		mutationFn: (body: { name: string; surface: string; intent: string }) =>
			projectionTemplatesApi.create(username, graphSlug, {
				...body,
				kind: "result",
				accepts: acceptsFor(body.surface),
			}),
		onSuccess: invalidate,
	});
	return { publish, remove, create };
}

/**
 * The shape a new result template accepts follows its surface — the same
 * constraints the shipped templates declare, so selection ranks them together.
 */
function acceptsFor(surface: string): Record<string, unknown> {
	if (surface === "metric")
		return { result_type: "tabular", single_value: true };
	if (surface === "chart") return { result_type: "tabular", categorical: true };
	if (surface === "subgraph") return { result_type: "graph", min_rows: 0 };
	return { result_type: "tabular", min_rows: 1 };
}
