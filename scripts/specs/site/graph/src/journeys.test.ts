import { describe, expect, it } from "vitest";
import {
	filterGroups,
	highlightOf,
	journeyGroups,
	journeyLanes,
	journeyView,
	LANE_GRID,
	laneId,
	toJourneyData,
} from "./journeys";
import { indexGraph, type SpecGraph } from "./model";

const node = (id: string, kind: string, extra: object = {}) => ({
	id,
	kind,
	title: `${id} title`,
	path: null,
	status: null,
	placeholder: false,
	product: id.slice(0, 2),
	...extra,
});
const next = (source: string, target: string, journey: string) => ({
	source,
	target,
	type: "NEXT",
	via: "The journey",
	journey,
	label: "",
});

/** Two journeys meeting at MO-02; one step of J01's own; a story on no journey. */
const GRAPH: SpecGraph = {
	version: 1,
	analysis: {},
	nodes: [
		node("MO", "Product"),
		node("MO-F01", "Feature"),
		node("MO-01", "Story"),
		node("MO-02", "Story"),
		node("MO-03", "Story"),
		node("MO-09", "Story"),
		node("J01", "Journey", { product: null }),
		node("J02", "Journey", { product: null }),
		node("J01:D", "Step", { product: null, journey: "J01", shape: "decision" }),
	],
	edges: [
		...["MO-01", "MO-02", "MO-03", "MO-09"].map((s) => ({
			source: s,
			target: "MO-F01",
			type: "PART_OF",
			via: "feature",
		})),
		next("MO-01", "J01:D", "J01"),
		next("J01:D", "MO-02", "J01"),
		next("MO-02", "MO-03", "J02"),
	],
};

describe("the Journeys view", () => {
	const index = indexGraph(GRAPH);
	const view = journeyView(index);
	const palette = {
		type: () => 0,
		muted: 0x999999,
		alert: 0,
		data: (slot: number) => slot + 100,
	};

	it("draws only stories and steps on a path, a head per lane, with every NEXT edge", () => {
		const data = toJourneyData(index, view, palette);
		expect(data.nodes.map((n) => n.id)).toEqual([
			"lane:J01",
			"lane:J02",
			"J01:D",
			"MO-01",
			"MO-02",
			"MO-03",
		]);
		expect(data.edges).toHaveLength(3);
		expect(data.nodes.find((n) => n.id === "J01:D")?.style.shape.kind).toBe(
			"regular-polygon",
		);
	});

	it("reads a story's id at overview and its title up close; a step's name only up close", () => {
		const data = toJourneyData(index, view, palette);
		const label = (id: string) => {
			const n = data.nodes.find((m) => m.id === id);
			return {
				overview: (n?.style as { labelText?: string } | undefined)?.labelText,
				detail: n && "state" in n ? n.state.detail.labelText : undefined,
			};
		};
		expect(label("MO-01")).toEqual({
			overview: "MO-01",
			detail: "MO-01 · MO-01 title",
		});
		expect(label("J01:D")).toEqual({
			overview: undefined,
			detail: "J01:D title",
		});
	});

	it("lays each journey in its own lane, left to right, a shared story in the first journey's lane", () => {
		const { positions, owner } = journeyLanes(view);
		const at = (id: string) => positions.get(id) ?? { x: NaN, y: NaN };
		// J01 reads MO-01 → J01:D → MO-02 along one row.
		expect(["MO-01", "J01:D", "MO-02"].map((id) => at(id).x)).toEqual([
			0,
			LANE_GRID.column,
			2 * LANE_GRID.column,
		]);
		expect(
			new Set(["MO-01", "J01:D", "MO-02"].map((id) => at(id).y)).size,
		).toBe(1);
		// MO-02 is J02's start too, but it stays in J01's lane; MO-03 is J02's, one step on, in the lane below.
		expect(owner.get("MO-02")).toBe("J01");
		expect(owner.get("MO-03")).toBe("J02");
		expect(at("MO-03").x).toBe(LANE_GRID.column);
		expect(at("MO-03").y).toBeGreaterThan(at("MO-02").y);
		expect(at(laneId("J02")).y).toBeLessThan(at("MO-03").y);
	});

	it("lights a journey's path, and every journey a shared story is on", () => {
		expect(highlightOf(view, "J02").sort()).toEqual([
			"MO-02",
			"MO-03",
			"lane:J02",
		]);
		expect(highlightOf(view, "MO-02").sort()).toEqual([
			"J01:D",
			"MO-01",
			"MO-02",
			"MO-03",
			"lane:J01",
			"lane:J02",
		]);
	});

	it("builds Product → Feature → Story and the journeys, leaving off-path stories out", () => {
		const [products, journeys] = filterGroups(index, view);
		const stories = products?.items[0]?.children?.[0]?.children ?? [];
		expect(stories.map((s) => s.id)).toEqual(["MO-01", "MO-02", "MO-03"]);
		expect(journeys?.items.map((j) => j.id)).toEqual(["J01", "J02"]);
	});
});

describe("Group by", () => {
	const serves = (source: string, target: string) => ({
		source,
		target,
		type: "SERVES",
		via: "persona",
	});
	// Two personas: MO-02 serves both; MO-09 serves one but is on no journey.
	const index = indexGraph({
		...GRAPH,
		nodes: [
			...GRAPH.nodes,
			node("persona:a", "Persona", { product: null }),
			node("persona:b", "Persona", { product: null }),
		],
		edges: [
			...GRAPH.edges,
			serves("MO-01", "persona:a"),
			serves("MO-02", "persona:a"),
			serves("MO-02", "persona:b"),
			serves("MO-09", "persona:a"),
		],
	});
	const view = journeyView(index);
	const groups = (by: Parameters<typeof journeyGroups>[2], hidden?: string[]) =>
		journeyGroups(index, view, by, new Set(hidden)).map((g) => [
			g.id,
			g.members,
		]);

	it("wraps the stories of each capability, feature, persona and journey; a shared story in each", () => {
		expect(groups("none")).toEqual([]);
		expect(groups("capability")).toEqual([
			["capability:MO", ["MO-01", "MO-02", "MO-03"]],
		]);
		expect(groups("feature")).toEqual([
			["feature:MO-F01", ["MO-01", "MO-02", "MO-03"]],
		]);
		expect(groups("persona")).toEqual([
			["persona:persona:a", ["MO-01", "MO-02"]],
			["persona:persona:b", ["MO-02"]],
		]);
		// MO-02 sits in J01's lane, and J02's hull reaches it there.
		expect(groups("journey")).toEqual([
			["journey:J01", ["MO-01", "MO-02"]],
			["journey:J02", ["MO-02", "MO-03"]],
		]);
	});

	it("drops a hidden story from its hulls, and a hull left empty; a journey's hull keeps its legend colour", () => {
		expect(groups("persona", ["MO-02"])).toEqual([
			["persona:persona:a", ["MO-01"]],
		]);
		const j02 = journeyGroups(index, view, "journey", new Set(["MO-01"])).find(
			(g) => g.id === "journey:J02",
		);
		expect(j02?.slot).toBe(view.slots.get("J02"));
	});
});
