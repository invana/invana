import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { describe, expect, it } from "vitest";
import { gapsByNode } from "./AnalysisPanel";
import {
	defaultFilters,
	indexGraph,
	type SpecEdge,
	type SpecGraph,
	type SpecNode,
	sankeyEdges,
	toGraphData,
} from "./model";
import { collectorUp } from "./telemetry";
import {
	blastRadius,
	loopSets,
	productSets,
	readAnalysis,
	shortestPath,
	unreadyIds,
} from "./thinking";

const node = (
	id: string,
	kind: string,
	extra: Partial<SpecNode> = {},
): SpecNode => ({
	id,
	kind,
	title: id,
	path: null,
	status: "specified",
	placeholder: false,
	product: id.slice(0, 2),
	...extra,
});
const edge = (source: string, type: string, target: string): SpecEdge => ({
	source,
	target,
	type,
	via: "",
});

/**
 * Two products in a loop; MO-F02 depends on MO-F01; a story of each feature; an NFR the first feature must meet, in
 * a design section; a decision on MO-F01 and a mention from EX-01.
 */
const GRAPH: SpecGraph = {
	version: 1,
	nodes: [
		node("MO", "Product"),
		node("EX", "Product", { status: "idea" }),
		node("MO-F01", "Feature"),
		node("MO-F02", "Feature"),
		node("MO-01", "Story"),
		node("MO-02", "Story"),
		node("EX-01", "Story", { status: "idea" }),
		node("NFR-REL-00", "NFR", { placeholder: true, product: null }),
		node("system-design#3", "DesignSection", {
			placeholder: true,
			product: null,
		}),
		node("MO-F01/D1", "Decision"),
	],
	edges: [
		edge("MO", "DEPENDS_ON", "EX"),
		edge("EX", "DEPENDS_ON", "MO"),
		edge("MO-F01", "PART_OF", "MO"),
		edge("MO-F02", "PART_OF", "MO"),
		edge("MO-F02", "DEPENDS_ON", "MO-F01"),
		edge("MO-01", "PART_OF", "MO-F01"),
		edge("MO-02", "PART_OF", "MO-F02"),
		edge("MO-F01", "MUST_MEET", "NFR-REL-00"),
		edge("NFR-REL-00", "PART_OF", "system-design#3"),
		edge("MO-F01/D1", "DECIDES", "MO-F01"),
		edge("EX-01", "MENTIONS", "MO-02"),
	],
	analysis: {
		cycles: [["EX", "MO"]],
		chains: [],
		blockers: [],
		orphans: [],
		gaps: [
			{ node: "MO-F02", gap: "no-nfrs" },
			{ node: "MO-F02", gap: "placeholder-engine" },
		],
	},
};
const index = indexGraph(GRAPH);
const all = new Set(GRAPH.nodes.map((n) => n.id));
const palette = {
	type: () => 0x111111,
	muted: 0x999999,
	alert: 0xff9900,
	data: (slot: number) => slot,
};

describe("sankey", () => {
	it("flows story → feature → NFR → design section, and nothing else", () => {
		const flow = sankeyEdges(index, defaultFilters(index));
		expect(flow.map((e) => `${e.source}>${e.target}`).sort()).toEqual([
			"MO-01>MO-F01",
			"MO-02>MO-F02",
			"MO-F01>NFR-REL-00",
			"NFR-REL-00>system-design#3",
		]);
		const data = toGraphData(index, defaultFilters(index), "sankey", palette);
		expect(data.nodes.map((n) => n.id)).not.toContain("MO");
		expect(data.edges.every((e) => e.data.value === 1)).toBe(true);
		expect(data.edges[0]?.style.arrowTargetShape).toBe("none");
	});
});

describe("blast radius", () => {
	it("reaches every dependent and part, with its distance", () => {
		const reach = blastRadius(index, "MO-F01");
		expect(Object.fromEntries(reach)).toEqual({
			"MO-F01": 0,
			"MO-F02": 1,
			"MO-01": 1,
			"MO-02": 2,
		});
	});

	it("does not travel along a decision or a mention", () => {
		expect([...blastRadius(index, "MO-02").keys()]).toEqual(["MO-02"]);
	});
});

describe("path", () => {
	it("takes the fewest typed edges, in either direction", () => {
		const path = shortestPath(index, "MO-01", "MO-02", all);
		expect(path?.nodes).toEqual(["MO-01", "MO-F01", "MO-F02", "MO-02"]);
		expect(path?.edges).toHaveLength(3);
	});

	it("falls back to a mention, and is null when nothing joins the two", () => {
		expect(shortestPath(index, "EX-01", "MO-02", all)?.nodes).toEqual([
			"EX-01",
			"MO-02",
		]);
		const noMention = new Set([...all].filter((id) => id !== "MO-02"));
		expect(shortestPath(index, "EX-01", "MO-F01", noMention)).toBeNull();
	});
});

describe("groups, density and analysis", () => {
	it("groups by product and by loop, over the shown nodes only", () => {
		expect(productSets(index, all).map((s) => s.id)).toEqual([
			"product:EX",
			"product:MO",
		]);
		const oneOfEx = new Set([...all].filter((id) => id !== "EX-01"));
		expect(productSets(index, oneOfEx).map((s) => s.id)).toEqual([
			"product:MO",
		]);
		expect(loopSets(readAnalysis(GRAPH.analysis), all)).toEqual([
			{ id: "loop:1", label: "Loop 1", members: ["EX", "MO"] },
		]);
		expect(loopSets(readAnalysis(GRAPH.analysis), new Set(["MO"]))).toEqual([]);
	});

	it("weighs idea and placeholder nodes", () => {
		expect(unreadyIds(index, all).sort()).toEqual([
			"EX",
			"EX-01",
			"NFR-REL-00",
			"system-design#3",
		]);
	});

	it("reads a missing analysis list as empty and groups gaps by feature", () => {
		const a = readAnalysis({ gaps: GRAPH.analysis.gaps });
		expect(a.cycles).toEqual([]);
		expect(gapsByNode(a)).toEqual([
			["MO-F02", ["no NFRs", "Engine is a placeholder"]],
		]);
	});
});

describe("telemetry", () => {
	it("stays silent when no collector answers", async () => {
		expect(await collectorUp("http://127.0.0.1:9", 500)).toBe(false);
	});

	it("finds a collector that accepts an OTLP trace export", async () => {
		const paths: string[] = [];
		const server = createServer((req, res) => {
			paths.push(`${req.method} ${req.url}`);
			res.writeHead(200).end("{}");
		});
		await new Promise<void>((ok) => server.listen(0, "127.0.0.1", ok));
		const { port } = server.address() as AddressInfo;
		try {
			expect(await collectorUp(`http://127.0.0.1:${port}`)).toBe(true);
			expect(paths).toEqual(["POST /v1/traces"]);
		} finally {
			server.close();
		}
	});
});
