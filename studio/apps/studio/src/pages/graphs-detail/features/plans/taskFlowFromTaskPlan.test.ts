import { describe, expect, it } from "vitest";
import { taskFlowFromTaskPlan } from "./taskFlowFromTaskPlan";
import type { PlanPerformance, TaskPlanDetail } from "./types";

const plan = {
	nodes: [
		{
			id: "a",
			label: "Read",
			task: "graph_read",
			layer: "graph data",
			form: "task",
			args: {},
			pinned_by_count: 2,
		},
		{
			id: "b",
			label: "",
			task: "ask",
			layer: "human",
			form: "human",
			args: { q: "which" },
			pinned_by_count: 0,
		},
	],
	edges: [{ source: "a", target: "b", kind: "order", label: "then" }],
} as unknown as TaskPlanDetail;

describe("taskFlowFromTaskPlan", () => {
	it("marks a wide step and a rare branch, and says so in the summary", () => {
		const steps = [
			{ step_key: "a", p50_ms: 100, p95_ms: 900, ran_in: 1, failed: 1 },
			{ step_key: "b", p50_ms: 50, p95_ms: 60, ran_in: 0.1, failed: 0 },
		] as unknown as PlanPerformance["steps"];
		const { nodes, edges } = taskFlowFromTaskPlan(plan, steps);
		expect(nodes[0].states).toEqual(["wide"]);
		expect(nodes[0].data.summary).toBe("p50 100ms · 1 failed · p95 900ms");
		expect(nodes[0].data.rows).toEqual([{ label: "pinned by", value: "2" }]);
		expect(nodes[1].states).toEqual(["rare"]);
		expect(nodes[1].data.summary).toBe("p50 50ms · runs in 10%");
		expect(edges[0].states).toEqual(["rare"]);
	});

	it("draws an unmeasured plan plain", () => {
		const { nodes, edges } = taskFlowFromTaskPlan(plan);
		expect(nodes.map((n) => [n.states, n.data.summary])).toEqual([
			[[], ""],
			[[], ""],
		]);
		expect(nodes[1].data.stepKey).toBe("a person");
		expect(edges[0].states).toEqual([]);
	});
});
