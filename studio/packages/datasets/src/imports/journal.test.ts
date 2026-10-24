import type { TaskRunSummary } from "@invana-studio/core";
import { describe, expect, it } from "vitest";
import { mergeImports } from "./journal";

const airways = { username: "admin", graphSlug: "airways", name: "Airways" };
const arabidopsis = {
	username: "admin",
	graphSlug: "arabidopsis",
	name: "Arabidopsis",
};

function run(
	id: string,
	kind: string | null,
	queued: string,
	extra: Partial<TaskRunSummary> = {},
): TaskRunSummary {
	return {
		id,
		flow_key: "dataset-import",
		status: "succeeded",
		kind,
		body: `Import ${id}`,
		plan_origin: null,
		plan_revision: 1,
		replans: 0,
		agent_id: null,
		role: "execute",
		triggered_by: "user",
		task_id: null,
		task_title: null,
		queued_at: queued,
		started_at: queued,
		finished_at: null,
		duration_ms: null,
		step_count: 0,
		step_label: null,
		steps_done: 0,
		steps_total: 0,
		served: null,
		promoted: false,
		tokens_in: 0,
		tokens_out: 0,
		tokens: 0,
		...extra,
	};
}

describe("the imports journal", () => {
	it("merges every Graph's loads newest first, each naming its Graph", () => {
		const rows = mergeImports([
			{
				graph: airways,
				items: [
					run("a1", "import", "2026-10-09T10:00:00"),
					run("a1", "import", "2026-10-09T10:00:00"),
				],
			},
			{
				graph: arabidopsis,
				items: [run("b1", "bulk", "2026-10-10T10:00:00")],
			},
		]);
		expect(rows.map((r) => [r.id, r.graph.graphSlug, r.kind])).toEqual([
			["b1", "arabidopsis", "bulk"],
			["a1", "airways", "import"],
		]);
	});

	it("drops a run that is not a load", () => {
		const rows = mergeImports([
			{
				graph: airways,
				items: [
					run("q1", "ask", "2026-10-10T10:00:00"),
					run("c1", null, "2026-10-10T10:00:00"),
				],
			},
		]);
		expect(rows).toEqual([]);
	});
});
