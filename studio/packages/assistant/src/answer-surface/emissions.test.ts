import type { QueryResponse } from "@invana-studio/core";
import { describe, expect, it } from "vitest";
import { emissionsFromResult, linkHref, linksFromRows } from "./emissions";

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

describe("linksFromRows", () => {
	it("reads a link row and opens it marked as the assistant's", () => {
		const [link] = linksFromRows([
			{ id: "t", seq: 0, kind: "table", payload: {} },
			{
				id: "l",
				seq: 1,
				kind: "link",
				payload: {
					list: "runs",
					label: "Runs",
					noun: ["run", "runs"],
					path: "/agents/runs",
					params: { "f.status": "failed", "f.since": "30d" },
					chips: [],
					total: 2,
					unresolved: [],
				},
			},
		]);
		expect(link).toMatchObject({ id: "l", label: "Runs", total: 2 });
		expect(linkHref(link, "admin", "airways")).toBe(
			"/u/admin/airways/agents/runs?f.status=failed&f.since=30d&via=assistant",
		);
	});
});
