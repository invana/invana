import { describe, expect, it } from "vitest";
import type { QueryResponse } from "@/types/query";
import { emissionsFromResult } from "./emissions";

const graph = (nodes: unknown[]) =>
	({
		result_type: "graph",
		data: { nodes, edges: [] },
		rows: null,
		row_count: 0,
	}) as unknown as QueryResponse;

describe("emissionsFromResult", () => {
	it("folds a graph into a subgraph and a table into a table", () => {
		const [sub] = emissionsFromResult(graph([{ id: 1 }]), { onCanvas: true });
		expect(sub).toMatchObject({
			kind: "subgraph",
			onCanvas: true,
			citation: { recordCount: 1 },
		});
		const [table] = emissionsFromResult({
			result_type: "tabular",
			data: null,
			rows: [{ n: 1 }, { n: 2 }],
			row_count: 2,
		} as unknown as QueryResponse);
		expect(table).toMatchObject({
			kind: "table",
			citation: { recordCount: 2 },
		});
	});

	it("says the graph holds nothing, never an empty table", () => {
		expect(emissionsFromResult(graph([]))[0].kind).toBe("empty");
		expect(
			emissionsFromResult({
				result_type: "tabular",
				data: null,
				rows: [],
				row_count: 0,
			} as unknown as QueryResponse)[0].kind,
		).toBe("empty");
		expect(emissionsFromResult(null)).toEqual([]);
	});
});
