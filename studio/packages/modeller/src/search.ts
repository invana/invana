import { type GraphRef, lensesApi, type SearchHit } from "@invana-studio/core";
import { Boxes, Circle, Globe, Spline } from "lucide-react";
import { modelsApi } from "./models/api";
import type { GlobalType } from "./models/types";

/**
 * ⌘K's Modeller records: the Graph's models, the node and edge types of its
 * union, and its named worlds. Neither a model nor a type has a path of its
 * own, so both open Models; a world opens its own page.
 */
export async function searchModeller(graph: GraphRef): Promise<SearchHit[]> {
	const [models, union, worlds] = await Promise.all([
		modelsApi.list(graph.username, graph.graphSlug),
		modelsApi.globalModel(graph.username, graph.graphSlug),
		lensesApi.list(graph.username, graph.graphSlug, { kind: "world" }),
	]);
	const typeHits = (
		types: GlobalType[],
		what: string,
		icon: SearchHit["icon"],
	): SearchHit[] =>
		types.map((t) => ({
			id: `${what}:${t.name}`,
			label: t.name,
			detail: `${what} · ${t.models.join(", ")}`,
			icon,
			to: "models",
		}));
	return [
		...models.map((m) => ({
			id: m.id,
			label: m.name,
			detail: "model",
			icon: Boxes,
			to: "models",
		})),
		...typeHits(union.node_types, "node type", Circle),
		...typeHits(union.edge_types, "edge type", Spline),
		...worlds.items.map((w) => ({
			id: w.id,
			label: w.display_name,
			detail: "world",
			icon: Globe,
			to: `worlds/${encodeURIComponent(w.id)}`,
		})),
	];
}
