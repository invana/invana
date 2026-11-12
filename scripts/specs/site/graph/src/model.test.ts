import { describe, expect, it } from "vitest";
import {
	defaultFilters,
	focusFrom,
	indexGraph,
	pageUrl,
	type SpecGraph,
	TREE_ROOT,
	toGraphData,
	treeEdges,
	visibleIds,
} from "./model";

/** A fixture parse: one product, one feature, two stories, a persona, a placeholder NFR and a decision. */
const GRAPH: SpecGraph = {
	version: 1,
	analysis: {},
	nodes: [
		{
			id: "MO",
			kind: "Product",
			title: "Modeller",
			path: "specs/products/modeller/product.md",
			status: "idea",
			placeholder: false,
			product: "MO",
		},
		{
			id: "EX",
			kind: "Product",
			title: "Explorer",
			path: "specs/products/explorer/README.md",
			status: "idea",
			placeholder: false,
			product: "EX",
		},
		{
			id: "MO-F01",
			kind: "Feature",
			title: "Models",
			path: "specs/products/modeller/features/MO-F01/feature.md",
			status: "drawn",
			placeholder: false,
			product: "MO",
		},
		{
			id: "MO-01",
			kind: "Story",
			title: "Draw a model",
			path: "specs/products/modeller/features/MO-F01/stories/MO-01/story.md",
			status: "drawn",
			placeholder: false,
			product: "MO",
		},
		{
			id: "EX-01",
			kind: "Story",
			title: "Explore",
			path: "specs/products/explorer/features/EX-F01/stories/EX-01/story.md",
			status: "idea",
			placeholder: false,
			product: "EX",
		},
		{
			id: "persona:modeller",
			kind: "Persona",
			title: "Modeller",
			path: "specs/personas.md",
			status: null,
			placeholder: false,
			product: null,
		},
		{
			id: "NFR-REL-00",
			kind: "NFR",
			title: "Reliability",
			path: "specs/system-design.md",
			status: "placeholder",
			placeholder: true,
			product: null,
		},
		{
			id: "MO-F01/D1",
			kind: "Decision",
			title: "One model",
			path: "specs/products/modeller/features/MO-F01/feature.md",
			status: "drawn",
			placeholder: false,
			product: "MO",
		},
		{
			id: "MO-01.1",
			kind: "Criterion",
			title: "the model is saved",
			path: "specs/products/modeller/features/MO-F01/stories/MO-01/story.md",
			status: "drawn",
			placeholder: false,
			product: "MO",
			description: "Given a draft — When it is saved — Then the model is saved",
		},
		{
			id: "record:model_models",
			kind: "Record",
			title: "model_models",
			path: "specs/products/modeller/features/MO-F01/feature.md",
			status: "drawn",
			placeholder: false,
			product: "MO",
			description: "One row per model",
		},
		{
			id: "board:mo.list",
			kind: "Board",
			title: "mo.list",
			path: null,
			status: "placeholder",
			placeholder: true,
			product: null,
		},
	],
	edges: [
		{ source: "MO-F01", target: "MO", type: "PART_OF", via: "product:" },
		{ source: "MO-01", target: "MO-F01", type: "PART_OF", via: "feature:" },
		{
			source: "MO-01",
			target: "persona:modeller",
			type: "SERVES",
			via: "personas:",
		},
		{ source: "MO-F01", target: "NFR-REL-00", type: "MUST_MEET", via: "nfrs:" },
		{
			source: "MO-F01/D1",
			target: "MO-F01",
			type: "DECIDES",
			via: "Decisions",
		},
		{
			source: "MO-01",
			target: "board:mo.list",
			type: "DRAWN_ON",
			via: "Screens",
		},
		{ source: "EX-01", target: "MO-01", type: "MENTIONS", via: "prose" },
		{
			source: "MO-01.1",
			target: "MO-01",
			type: "PART_OF",
			via: "Acceptance criteria",
		},
		{
			source: "MO-F01",
			target: "record:model_models",
			type: "OWNS",
			via: "Records",
		},
	],
};

const palette = {
	type: () => 0x111111,
	muted: 0x999999,
	alert: 0xff9900,
	data: (slot: number) => slot,
};

describe("filters", () => {
	it("hides decisions on load, unless the focused node is one", () => {
		const index = indexGraph(GRAPH);
		expect(visibleIds(index, defaultFilters(index)).has("MO-F01/D1")).toBe(
			false,
		);
		expect(
			visibleIds(index, defaultFilters(index, "MO-F01/D1")).has("MO-F01/D1"),
		).toBe(true);
	});

	it("hides criteria and Engine records on load, and Filters offers them with their counts", () => {
		const index = indexGraph(GRAPH);
		const shown = visibleIds(index, defaultFilters(index));
		expect(shown.has("MO-01.1")).toBe(false);
		expect(shown.has("record:model_models")).toBe(false);
		expect(index.counts.kinds).toContainEqual(["Criterion", 1]);
		expect(index.counts.kinds).toContainEqual(["Record", 1]);
		const on = defaultFilters(index);
		const data = toGraphData(
			index,
			{ ...on, kinds: new Set([...on.kinds, "Record"]) },
			"force",
			palette,
		);
		const record = data.nodes.find((n) => n.id === "record:model_models");
		expect(record?.data.description).toBe("One row per model");
		expect(data.edges.map((e) => e.type)).toContain("OWNS");
	});

	it("narrows to a product and the product-less nodes it touches", () => {
		const index = indexGraph(GRAPH);
		const ids = visibleIds(index, {
			...defaultFilters(index),
			products: new Set(["MO"]),
		});
		expect(ids).toContain("MO-01");
		expect(ids).toContain("board:mo.list");
		expect(ids).toContain("NFR-REL-00");
		expect(ids).not.toContain("EX-01");
	});

	it("narrows to what serves a persona", () => {
		const index = indexGraph(GRAPH);
		const ids = visibleIds(index, {
			...defaultFilters(index),
			personas: new Set(["persona:modeller"]),
		});
		expect([...ids].sort()).toEqual(["MO-01", "persona:modeller"]);
	});
});

describe("drawing", () => {
	it("draws a placeholder grey and dashed, and only edges between shown nodes", () => {
		const index = indexGraph(GRAPH);
		const data = toGraphData(
			index,
			{ ...defaultFilters(index), kinds: new Set(["Feature", "NFR", "Story"]) },
			"force",
			palette,
		);
		const nfr = data.nodes.find((n) => n.id === "NFR-REL-00");
		expect(nfr?.style.bgFill).toBe(0x999999);
		expect(nfr?.style.bgStrokeDashArray).toEqual([4, 3]);
		expect(
			data.nodes.find((n) => n.id === "MO-01")?.style.bgStrokeDashArray,
		).toBeUndefined();
		expect(data.edges.map((e) => e.type).sort()).toEqual([
			"MENTIONS",
			"MUST_MEET",
			"PART_OF",
		]);
	});

	it("gives the hierarchy layout one tree: containment parent → child, the rest under the root", () => {
		const index = indexGraph(GRAPH);
		const ids = visibleIds(index, defaultFilters(index, "MO-F01/D1"));
		const tree = treeEdges(index, ids);
		const parentOf = new Map(tree.map((e) => [e.target, e.source]));
		expect(parentOf.get("MO-01")).toBe("MO-F01");
		expect(parentOf.get("MO-F01/D1")).toBe("MO-F01");
		expect(parentOf.get("MO")).toBe(TREE_ROOT);
		expect(tree).toHaveLength(ids.size);
	});
});

describe("links", () => {
	it("maps a spec file to its site page", () => {
		expect(pageUrl("specs/products/modeller/product.md")).toBe(
			"products/modeller/product/",
		);
		expect(pageUrl("specs/products/explorer/README.md")).toBe(
			"products/explorer/",
		);
		expect(pageUrl("specs/README.md")).toBe("");
	});

	it("has no page for a board or a file outside specs/", () => {
		expect(pageUrl(null)).toBeNull();
		expect(pageUrl("docs/index.md")).toBeNull();
	});

	it("reads the focused node from the query", () => {
		expect(focusFrom("?focus=system-design%231")).toBe("system-design#1");
		expect(focusFrom("?other=1")).toBeNull();
	});
});
