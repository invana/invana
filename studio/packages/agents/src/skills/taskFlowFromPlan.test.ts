import { describe, expect, it } from "vitest";
import { gapNodeId, handlerNodeId, taskFlowFromPlan } from "./taskFlowFromPlan";
import type { SkillPlaybookRead } from "./types";

const plan = {
	nodes: [
		{
			id: "a",
			label: "",
			task: "graph_read",
			layer: "graph data",
			form: "task",
			args: { limit: 5 },
			source_plan_key: "base",
			source_span: "List the routes.",
		},
		{
			id: "b",
			label: "Ask",
			task: "ask",
			layer: "human",
			form: "human",
			args: {},
			source_span: null,
		},
	],
	edges: [
		{ source: "a", target: "b", kind: "order", label: "then" },
		{ source: "a", target: "b", kind: "binding", label: "rows" },
	],
} as unknown as SkillPlaybookRead;

describe("taskFlowFromPlan", () => {
	it("draws each step with its layer, line and args, and order as require", () => {
		const { nodes, edges } = taskFlowFromPlan(plan, [], (s) => (s ? 12 : null));
		expect(nodes[0].data).toMatchObject({
			title: "graph_read",
			icon: "lucide/database",
			kind: "step",
			caption: "step 1 · from line 12",
			rows: [
				{ label: "step", value: "1 · from line 12" },
				{ label: "from", value: "base", mono: true },
				{ label: "limit", value: "5", mono: true },
			],
		});
		expect(nodes[1].data.stepKey).toBe("a person");
		expect(edges.map((e) => e.data?.kind)).toEqual(["require", "binding"]);
	});

	it("chains every step in plan order and draws one gap per unmapped line", () => {
		const c = { ...plan.nodes[0], id: "c", source_span: "Count them." };
		const lines: Record<string, number> = {
			"List the routes.": 1,
			"Email it.": 2,
			"Count them.": 3,
		};
		const { nodes, edges } = taskFlowFromPlan(
			{ ...plan, nodes: [...plan.nodes, c] },
			[],
			(s) => (s ? (lines[s] ?? null) : null),
			["Email it.", "Email it."],
		);
		expect(
			edges
				.filter((e) => e.data.kind === "sequence")
				.map((e) => [e.source, e.target]),
		).toEqual([["b", "c"]]);
		expect(nodes.filter((n) => n.id.startsWith("gap:"))).toHaveLength(1);
		expect(edges.at(-1)).toMatchObject({ source: "a", target: gapNodeId(0) });
	});

	it("hangs a handler off the step it names, else off the last step", () => {
		const { nodes, edges } = taskFlowFromPlan(plan, [
			{ span: "Refused: skip it.", step_id: "a" },
			{ span: "No page: say so.", step_id: null },
		]);
		expect(nodes.map((n) => n.id)).toContain(handlerNodeId(1));
		expect(edges.slice(2).map((e) => [e.source, e.target])).toEqual([
			["a", handlerNodeId(0)],
			["b", handlerNodeId(1)],
		]);
	});

	it("draws a line the draw could not map as a gap beside the step before it", () => {
		const lines: Record<string, number> = {
			"List the routes.": 3,
			"Email it.": 4,
		};
		const { nodes, edges } = taskFlowFromPlan(
			plan,
			[],
			(s) => (s ? (lines[s] ?? null) : null),
			["Email it."],
		);
		expect(nodes.find((n) => n.id === gapNodeId(0))?.data).toMatchObject({
			kind: "gap",
			caption: "line 4 · “Email it.”",
		});
		expect(edges.at(-1)).toMatchObject({ source: "a", target: gapNodeId(0) });
	});
});
