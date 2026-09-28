import { describe, expect, it } from "vitest";
import { ApiError } from "@/services/api/client";
import type { QueryResponse } from "@/types/query";
import {
	adaptItems,
	expandRefusal,
	isCanvasStateSnapshot,
	labelAt,
	resultToItems,
} from "./canvasItems";

const graph = {
	result_type: "graph",
	data: {
		nodes: [
			{ id: 1, label: "airport", properties: { code: "MMK" } },
			{ id: 1, label: "airport", properties: { code: "MMK" } },
			{ id: 2, label: "airport", properties: { code: "SVO" } },
		],
		edges: [{ id: "e1", label: "route", source: 1, target: 2, properties: {} }],
	},
	rows: null,
	row_count: 3,
} as unknown as QueryResponse;

describe("resultToItems + adaptItems", () => {
	it("dedupes a graph result and hands the canvas label as type", () => {
		const items = resultToItems(graph);
		expect(items.map((i) => i.type)).toEqual(["vertex", "vertex", "edge"]);
		const data = adaptItems(items);
		expect(data.nodes[0]).toEqual({
			id: "1",
			type: "airport",
			data: { code: "MMK" },
		});
		expect(data.edges[0]).toMatchObject({ source: "1", target: "2" });
	});

	it("draws nothing for a table or no result", () => {
		expect(resultToItems(null)).toEqual([]);
		expect(
			resultToItems({ ...graph, result_type: "tabular" } as QueryResponse),
		).toEqual([]);
	});
});

describe("isCanvasStateSnapshot", () => {
	it("accepts the envelope and refuses anything short of it", () => {
		expect(isCanvasStateSnapshot({ version: 1, view: {}, data: {} })).toBe(
			true,
		);
		expect(isCanvasStateSnapshot({ version: 1, view: null, data: {} })).toBe(
			false,
		);
		expect(isCanvasStateSnapshot({ view: {}, data: {} })).toBe(false);
	});
});

describe("expandRefusal", () => {
	it("says what the lens lacks, or that the run is queued", () => {
		const outside = new ApiError(409, "x", {
			error: "outside_lens",
			message: "This lens does not hold Deals.",
		});
		expect(expandRefusal(outside)).toBe("This lens does not hold Deals.");
		const queued = new ApiError(409, "x", { error: "expand_queued" });
		expect(expandRefusal(queued)).toMatch(/queued/);
	});

	it("is a plain failure for anything else", () => {
		expect(expandRefusal(new ApiError(500, "boom"))).toBe(
			"Failed to load neighbours.",
		);
		expect(expandRefusal(new Error("net"))).toBe("Failed to load neighbours.");
	});
});

describe("labelAt", () => {
	const node = {
		id: "7",
		type: "airport",
		data: { code: "MMK", meta: { tier: 1 } },
	};

	it("reads a root field, a property and a nested property", () => {
		expect(labelAt(node, "id")).toBe("7");
		expect(labelAt(node, "type")).toBe("airport");
		expect(labelAt(node, "data.code")).toBe("MMK");
		expect(labelAt(node, "data.meta.tier")).toBe("1");
	});

	it("is empty where the path reaches nothing", () => {
		expect(labelAt(node, "data.name")).toBe("");
		expect(labelAt(node, "data.code.x")).toBe("");
	});
});
