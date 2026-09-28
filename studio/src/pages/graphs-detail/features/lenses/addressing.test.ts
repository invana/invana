import { describe, expect, it } from "vitest";
import {
	buildMatch,
	matches,
	nameOptionsIn,
	splitMatch,
	sublayersIn,
} from "./addressing";
import type { Participant } from "./types";

const p = (address: string) => {
	const [layer, sublayer, ...name] = address.split("/");
	return {
		address,
		layer,
		sublayer,
		name: name.join("/"),
		label: address,
	} as Participant;
};
const catalogue = [
	p("graph_data/model/Deals@1.0.1"),
	p("graph_data/model/Deals@1.0.2"),
	p("graph_data/dataset/crm"),
	p("llm/provider/claude-opus"),
];

describe("buildMatch + splitMatch", () => {
	it("rebuilds the three picks, and collapses */** to **", () => {
		expect(buildMatch({ layer: "graph_data", sublayer: "*", name: "**" })).toBe(
			"graph_data/**",
		);
		expect(splitMatch("graph_data/**")).toEqual({
			layer: "graph_data",
			sublayer: "*",
			name: "**",
		});
		expect(splitMatch("third_party/api/clearbit.com/v2")).toMatchObject({
			sublayer: "api",
			name: "clearbit.com/v2",
		});
		expect(splitMatch("llm")).toMatchObject({ sublayer: "*", name: "**" });
	});
});

describe("matches", () => {
	it("reads *, ** and a glob inside a segment", () => {
		expect(matches("graph_data/**", "graph_data/model/Deals@1.0.1")).toBe(true);
		expect(matches("graph_data/*/crm", "graph_data/dataset/crm")).toBe(true);
		expect(
			matches("graph_data/model/Deals@*", "graph_data/model/Deals@2"),
		).toBe(true);
	});

	it("misses another layer, a shorter address and a longer one", () => {
		expect(matches("llm/**", "graph_data/model/x")).toBe(false);
		expect(matches("graph_data/model/x", "graph_data/model")).toBe(false);
		expect(matches("graph_data/model", "graph_data/model/x")).toBe(false);
	});
});

describe("pickers", () => {
	it("offers a layer's sublayers, and @* beside each versioned name", () => {
		expect(sublayersIn(catalogue, "graph_data")).toEqual(["model", "dataset"]);
		const values = nameOptionsIn(catalogue, "graph_data", "model").map(
			(o) => o.value,
		);
		expect(values).toEqual(["**", "Deals@*", "Deals@1.0.1", "Deals@1.0.2"]);
		expect(nameOptionsIn(catalogue, "graph_data", "*")).toHaveLength(5);
	});
});
