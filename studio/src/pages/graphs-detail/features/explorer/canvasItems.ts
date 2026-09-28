import type { CanvasStateSnapshot } from "@invana/canvas";
import type { GraphData as EngineGraphData } from "@invana/graph";
import { ApiError } from "@/services/api/client";
import type { QueryResponse, QueryResultItem } from "@/types/query";

/**
 * A saved canvas state, as the engine will accept it. `canvas_states.snapshot`
 * is `Record<string, unknown>` on the wire, so this is the one place the shape
 * is established — the envelope only, since the engine validates the rest.
 */
export function isCanvasStateSnapshot(
	value: Record<string, unknown>,
): value is Record<string, unknown> & CanvasStateSnapshot {
	return (
		typeof value.version === "number" &&
		typeof value.view === "object" &&
		value.view !== null &&
		typeof value.data === "object" &&
		value.data !== null
	);
}

// Map query-result items (vertices / edges) to the canvas engine's GraphData
// shape: the label rides as `type` (colour-by-label + the Inspector's Type row)
// and the properties as `data`. Shared by the full-paint seed and the
// incremental node-expand append (docs/for-developers/modules/explore/features/graph-canvas.md).
export function adaptItems(items: QueryResultItem[]): EngineGraphData {
	const nodes: EngineGraphData["nodes"] = [];
	const edges: EngineGraphData["edges"] = [];
	for (const item of items) {
		if (item.type === "vertex") {
			nodes.push({
				id: String(item.id),
				type: item.label,
				data: item.properties,
			});
		} else if (item.type === "edge") {
			edges.push({
				id: String(item.id),
				source: String(item.source),
				target: String(item.target),
				type: item.label,
				data: item.properties,
			});
		}
	}
	return { nodes, edges };
}

// Dedupe a graph query result into canvas items (vertices + edges), keeping the
// first occurrence of each id — the same normalization `paintCanvas` does, reused
// to seed a new canvas's snapshot. Empty for a non-graph / null result.
export function resultToItems(result: QueryResponse | null): QueryResultItem[] {
	if (result?.result_type !== "graph" || !result.data) return [];
	const nodeMap = new Map<string, QueryResultItem>();
	for (const n of result.data.nodes) {
		const id = String(n.id);
		if (!nodeMap.has(id)) nodeMap.set(id, { ...n, type: "vertex" });
	}
	const edgeMap = new Map<string, QueryResultItem>();
	for (const e of result.data.edges) {
		const id = String(e.id);
		if (!edgeMap.has(id)) edgeMap.set(id, { ...e, type: "edge" });
	}
	return [...nodeMap.values(), ...edgeMap.values()];
}

/**
 * What a failed expansion says. A refusal names what the world lacks, and a
 * queued run says so — neither is "failed" (graph-canvas.md GC13).
 */
export function expandRefusal(err: unknown): string {
	const detail =
		err instanceof ApiError && err.status === 409
			? (err.detail as { error?: string; message?: string } | undefined)
			: undefined;
	if (detail?.error === "outside_lens" && detail.message) return detail.message;
	if (detail?.error === "expand_queued")
		return "This graph is busy — the expansion is queued behind other runs.";
	return "Failed to load neighbours.";
}
