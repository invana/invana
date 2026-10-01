import { describe, expect, it } from "vitest";
import type { TaskGroup } from "./runDashboards";
import { taskFlowFromRun } from "./taskFlowFromRun";

const group = (id: string, bound: string | null, extra: object = {}) =>
	({
		key: id,
		taskKey: `${id}_task`,
		label: id.toUpperCase(),
		lanes: 1,
		attempts: 1,
		steps: [],
		head: {
			id,
			bound,
			status: "succeeded",
			detail: "",
			duration_ms: 840,
			started_at: null,
			finished_at: null,
		},
		...extra,
	}) as unknown as TaskGroup;

describe("taskFlowFromRun", () => {
	it("chains the groups in seq order and says what each took", () => {
		const { nodes, edges } = taskFlowFromRun([
			group("a", "graph_read"),
			group("b", "llm", { lanes: 3, attempts: 2 }),
			group("c", "ingest"),
		]);
		expect(nodes.map((n) => n.data.icon)).toEqual([
			"lucide/database",
			"lucide/sparkles",
			"lucide/upload",
		]);
		expect(nodes[1].data.rows).toEqual([
			{ label: "status", value: "succeeded" },
			{ label: "took", value: "840ms" },
			{ label: "lanes", value: "3" },
			{ label: "attempts", value: "2" },
		]);
		expect(edges.map((e) => e.id)).toEqual(["a->b", "b->c"]);
	});

	it("draws one untimed task with no edges", () => {
		const untimed = group("a", null);
		untimed.head.duration_ms = null as never;
		const { nodes, edges } = taskFlowFromRun([untimed]);
		expect(nodes[0].data.rows).toEqual([
			{ label: "status", value: "succeeded" },
		]);
		expect(edges).toEqual([]);
	});
});
