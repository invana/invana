import { describe, expect, it } from "vitest";
import type { NeighbourRead, ReachVertex } from "../types";
import { PER_HOP, walkReach } from "./reach";

const v = (id: string, label: string, name?: string): ReachVertex => ({
	id,
	label,
	properties: name ? { name } : {},
});

/** A read over a fixed adjacency: each id → its neighbours and the edge label. */
function graph(
	nodes: Record<string, ReachVertex>,
	adj: Record<string, [string, string][]>,
	more: Record<string, boolean> = {},
) {
	return async (id: string): Promise<NeighbourRead> => {
		const out = adj[id] ?? [];
		return {
			data: {
				nodes: [nodes[id], ...out.map(([n]) => nodes[n])],
				edges: out.map(([n, label]) => ({
					id: [id, n].sort().join("~"),
					label,
					source: id,
					target: n,
				})),
			},
			total: more[id] ? out.length + 10 : out.length,
			returned: out.length,
			has_more: !!more[id],
			run_id: null,
		};
	};
}

describe("walkReach", () => {
	const nodes = {
		a: v("a", "Airport", "LHR"),
		b: v("b", "Airport", "JFK"),
		c: v("c", "City", "London"),
		d: v("d", "Country", "UK"),
	};
	const adj: Record<string, [string, string][]> = {
		a: [
			["b", "route"],
			["c", "IN"],
		],
		b: [["a", "route"]],
		c: [
			["a", "IN"],
			["d", "PART_OF"],
		],
		d: [["c", "PART_OF"]],
	};

	it("groups each hop by type and never counts a record twice", async () => {
		const reach = await walkReach({
			seeds: ["a", "a"],
			hops: 2,
			read: graph(nodes, adj),
		});
		expect(
			reach.hops.map((h) =>
				h.groups.map((g) => `${h.hop}:${g.count} ${g.label}`),
			),
		).toEqual([["0:1 Airport"], ["1:1 Airport", "1:1 City"], ["2:1 Country"]]);
		expect(reach.links).toContainEqual({
			fromHop: 1,
			fromLabel: "City",
			toLabel: "Country",
			edgeLabel: "PART_OF",
			count: 1,
		});
		expect(reach.hops.every((h) => h.groups.every((g) => !g.cut))).toBe(true);
		expect(reach.reads).toBe(3);
	});

	it("cuts a hop when the frontier is over the bound or a read has more", async () => {
		const seeds = Array.from({ length: PER_HOP + 3 }, (_, i) => `s${i}`);
		const many: Record<string, ReachVertex> = {};
		const adj: Record<string, [string, string][]> = {};
		for (const s of seeds) {
			many[s] = v(s, "Site");
			many[`p${s}`] = v(`p${s}`, "Place");
			adj[s] = [[`p${s}`, "AT"]];
		}
		const reads: string[] = [];
		const read = graph(many, adj);
		const wide = await walkReach({
			seeds,
			hops: 1,
			read: (id) => {
				reads.push(id);
				return read(id);
			},
		});
		expect(reads).toHaveLength(PER_HOP);
		// The seeds left unread keep the fallback type, and still count.
		expect(wide.hops[0].groups.map((g) => [g.label, g.count])).toEqual([
			["Site", PER_HOP],
			["record", 3],
		]);
		expect(wide.hops[1].groups[0]).toMatchObject({
			label: "Place",
			count: PER_HOP,
			cut: true,
		});

		const one = await walkReach({
			seeds: ["s0"],
			hops: 1,
			read: graph(many, adj, { s0: true }),
		});
		expect(one.hops[1].groups[0].cut).toBe(true);
	});

	it("ranks the most reached by relationships, and records a refusal", async () => {
		const hub = {
			s: v("s", "Route"),
			h: v("h", "Airport", "Hub"),
			x: v("x", "Airport", "Spoke"),
			y: v("y", "City"),
		};
		const read = graph(hub, {
			s: [
				["h", "ARRIVES_AT"],
				["x", "DEPARTS_FROM"],
			],
			h: [["y", "IN"]],
		});
		const reach = await walkReach({
			seeds: ["s"],
			hops: 2,
			read: (id) =>
				id === "x"
					? Promise.reject(new Error("The graph is not connected."))
					: read(id),
		});
		expect(reach.top.map((r) => [r.name, r.degree])).toEqual([
			["Hub", 2],
			["Spoke", 1],
			["y", 1],
		]);
		expect(reach.errors).toEqual(["The graph is not connected."]);
		expect(reach.hops[2].groups[0]).toMatchObject({
			label: "City",
			cut: false,
		});
	});
});
