/**
 * What a Graph holds, type by type — the Explorer panel's legend and the
 * Modeller's record counts read the same answer (selection-and-the-panel.md).
 */

/** One type and how many of it the graph holds; `count` is null when the
 *  vendor cannot count (selection-and-the-panel.md). */
export interface TypeCount {
	name: string;
	count: number | null;
}

/** Every node and edge type in the graph, biggest first. */
export interface TypeCountsResponse {
	nodes: TypeCount[];
	edges: TypeCount[];
	/** False when the vendor could not count; every `count` is then null. */
	counted: boolean;
	/** Every node and every edge the graph holds; null when not counted. */
	total_nodes: number | null;
	total_edges: number | null;
}
