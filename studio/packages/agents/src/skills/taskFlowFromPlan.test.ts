import { describe, expect, it } from "vitest";
import { handlerNodeId, taskFlowFromPlan } from "./taskFlowFromPlan";
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
			rows: [
				{ label: "step", value: "1 · from line 12" },
				{ label: "from", value: "base", mono: true },
				{ label: "limit", value: "5", mono: true },
			],
		});
		expect(nodes[1].data.stepKey).toBe("a person");
		expect(edges.map((e) => e.data?.kind)).toEqual(["require", "binding"]);
	});

	it("chains the steps in order when the plan carries no edges", () => {
		const { edges } = taskFlowFromPlan({ ...plan, edges: [] });
		expect(edges.map((e) => [e.source, e.target, e.data.kind])).toEqual([
			["a", "b", "sequence"],
		]);
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
});
