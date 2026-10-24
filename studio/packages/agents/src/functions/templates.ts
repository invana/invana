/**
 * Answer templates — the reads and writes Functions › Templates and a
 * template's page share. Keys start `["projection-templates", owner, graph]`,
 * so authoring, publishing or removing one re-reads the list and the page.
 *
 * The list is on the list contract: the engine searches, filters and counts
 * this Graph's templates and the ones that ship with Invana.
 */

import {
	type ListQuery,
	listQueryKey,
	projectionTemplatesApi,
} from "@invana-studio/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

/** The surfaces a result template renders to. */
export const RESULT_SURFACES = [
	"table",
	"metric",
	"chart",
	"subgraph",
	"markdown",
] as const;

/** The surfaces a prompt template asks a closed question with. */
export const PROMPT_SURFACES = [
	"choice",
	"multi-choice",
	"boolean",
	"pick-from-graph",
	"value",
	"confirm",
] as const;

export type TemplateKind = "result" | "prompt";

/** What *Author a template* sends — the engine's create body, whole. */
export interface TemplateDraft {
	name: string;
	kind: TemplateKind;
	surface: string;
	intent: string;
	accepts: Record<string, unknown>;
	spec: Record<string, unknown>;
}

const templatesKey = (username: string, graphSlug: string) =>
	["projection-templates", username, graphSlug] as const;

export function useTemplateListQuery(
	username: string,
	graphSlug: string,
	query: ListQuery,
) {
	return useQuery({
		queryKey: [...templatesKey(username, graphSlug), listQueryKey(query)],
		queryFn: () => projectionTemplatesApi.list(username, graphSlug, query),
	});
}

/** One template, for its page. */
export function useTemplateQuery(
	username: string,
	graphSlug: string,
	id: string,
) {
	return useQuery({
		queryKey: [...templatesKey(username, graphSlug), "one", id],
		queryFn: () => projectionTemplatesApi.get(username, graphSlug, id),
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
	// Authoring always lands a draft; *Publish* in the same modal is that
	// draft's publish, sent straight after.
	const create = useMutation({
		mutationFn: async ({
			draft,
			publish,
		}: {
			draft: TemplateDraft;
			publish: boolean;
		}) => {
			const made = await projectionTemplatesApi.create(
				username,
				graphSlug,
				draft,
			);
			return publish
				? projectionTemplatesApi.publish(username, graphSlug, made.id)
				: made;
		},
		onSettled: invalidate,
	});
	return { publish, remove, create };
}

/**
 * The shape a new result template accepts, as its surface suggests it — the
 * same constraints the shipped templates declare, so selection ranks them
 * together. A prompt template constrains no result.
 */
export function acceptsFor(
	kind: TemplateKind,
	surface: string,
): Record<string, unknown> {
	if (kind === "prompt") return {};
	if (surface === "metric")
		return { result_type: "tabular", single_value: true };
	if (surface === "chart") return { result_type: "tabular", categorical: true };
	if (surface === "subgraph") return { result_type: "graph", min_rows: 0 };
	return { result_type: "tabular", min_rows: 1 };
}

/** The declared shape, one constraint per part: `result_type tabular · min_rows 1`. */
export function acceptsLine(accepts: Record<string, unknown>): string {
	return Object.entries(accepts ?? {})
		.map(([k, v]) => (v === true ? k : `${k} ${String(v)}`))
		.join(" · ");
}

const scalar = (raw: string): unknown =>
	raw === "true"
		? true
		: raw === "false"
			? false
			: raw !== "" && Number.isFinite(Number(raw))
				? Number(raw)
				: raw;

/** Read an accepts line back: a bare key is `true`, a number stays a number. */
export function parseAccepts(line: string): Record<string, unknown> {
	const out: Record<string, unknown> = {};
	for (const part of line.split("·")) {
		const [key, ...rest] = part.trim().split(/\s+/);
		if (!key) continue;
		out[key] = rest.length ? scalar(rest.join(" ")) : true;
	}
	return out;
}

/** Read a shape, one `key: value` per line, into the template's `spec`. */
export function parseShape(text: string): Record<string, unknown> {
	const out: Record<string, unknown> = {};
	for (const line of text.split("\n")) {
		const at = line.indexOf(":");
		const key = (at < 0 ? line : line.slice(0, at)).trim();
		if (!key) continue;
		out[key] = at < 0 ? true : scalar(line.slice(at + 1).trim());
	}
	return out;
}
