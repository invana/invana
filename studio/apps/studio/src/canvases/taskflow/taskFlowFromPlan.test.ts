import { describe, expect, it } from "vitest";
import type { SkillPlaybookRead } from "@/pages/graphs-detail/features/skills";
import { taskFlowFromPlan } from "./taskFlowFromPlan";

describe("taskFlowFromPlan", () => {
	it("draws each step with its layer and args, and order as require", () => {
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
				},
				{
					id: "b",
					label: "Ask",
					task: "ask",
					layer: "human",
					form: "human",
					args: {},
				},
			],
			edges: [
				{ source: "a", target: "b", kind: "order", label: "then" },
				{ source: "a", target: "b", kind: "binding", label: "rows" },
			],
		} as unknown as SkillPlaybookRead;
		const { nodes, edges } = taskFlowFromPlan(plan);
		expect(nodes[0].data).toMatchObject({
			title: "graph_read",
			icon: "lucide/database",
			rows: [
				{ label: "from", value: "base", mono: true },
				{ label: "limit", value: "5", mono: true },
			],
		});
		expect(nodes[1].data.stepKey).toBe("a person");
		expect(edges.map((e) => e.data?.kind)).toEqual(["require", "binding"]);
	});
});
