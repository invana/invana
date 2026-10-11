import type { TaskRunSummary } from "@invana-studio/core";
import { describe, expect, it } from "vitest";
import { importStats, importsByDay, mergeImports } from "./journal";

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
		workflow_key: "dataset-import",
		status: "succeeded",
		kind,
		body: `Import ${id}`,
		plan_origin: null,
		plan_revision: 1,
		replans: 0,
		agent_id: null,
		role: "execute",
		task_id: null,
		task_title: null,
		queued_at: queued,
		started_at: queued,
		finished_at: null,
		step_count: 0,
		step_label: null,
		steps_done: 0,
		steps_total: 0,
		served: null,
		promoted: false,
		tokens_in: 0,
		tokens_out: 0,
		...extra,
	};
}

const NOW = Date.parse("2026-10-11T12:00:00");

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

	it("buckets loads a day, empty days included, and ignores what is outside the window", () => {
		const rows = mergeImports([
			{
				graph: airways,
				items: [
					run("a1", "import", "2026-10-11T09:00:00"),
					run("a2", "import", "2026-10-11T10:00:00"),
					run("a3", "bulk", "2026-10-09T10:00:00"),
					run("old", "import", "2026-08-01T10:00:00"),
				],
			},
		]);
		const days = importsByDay(rows, NOW, 3);
		expect(days.map((d) => d.count)).toEqual([1, 0, 2]);
	});

	it("reads the tiles off the window, with no median when nothing finished", () => {
		const rows = mergeImports([
			{
				graph: airways,
				items: [
					run("a1", "import", "2026-10-11T09:00:00", {
						finished_at: "2026-10-11T09:01:00",
					}),
					run("a2", "import", "2026-10-11T10:00:00", { status: "running" }),
					run("a3", "import", "2026-10-10T10:00:00", {
						status: "failed",
						finished_at: "2026-10-10T10:00:20",
					}),
				],
			},
		]);
		expect(importStats(rows, NOW)).toEqual({
			total: 3,
			live: 1,
			failed: 1,
			medianMs: 40_000,
		});
		expect(importStats([], NOW).medianMs).toBeNull();
	});
});
