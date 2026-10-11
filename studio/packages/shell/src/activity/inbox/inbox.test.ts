import type { TaskRunSummary } from "@invana-studio/core";
import { describe, expect, it } from "vitest";
import { FAILED_WINDOW_MS, inboxOf, productOfRun } from "./inbox";

const NOW = Date.parse("2026-10-11T12:00:00Z");

function run(
	id: string,
	status: string,
	finishedAgoMs: number,
	extra: Partial<TaskRunSummary> = {},
): TaskRunSummary {
	return {
		id,
		workflow_key: "ask",
		status,
		kind: "ql",
		body: id,
		plan_origin: null,
		plan_revision: 1,
		replans: 0,
		agent_id: null,
		role: "execute",
		task_id: null,
		task_title: null,
		queued_at: null,
		started_at: new Date(NOW - finishedAgoMs).toISOString(),
		finished_at: new Date(NOW - finishedAgoMs).toISOString(),
		step_count: 1,
		step_label: null,
		steps_done: 1,
		steps_total: 1,
		served: null,
		promoted: false,
		tokens_in: 0,
		tokens_out: 0,
		...extra,
	};
}

describe("inboxOf", () => {
	it("holds waiting runs and recent failures, newest first", () => {
		const items = inboxOf(
			[
				run("old-failure", "failed", FAILED_WINDOW_MS + 1),
				run("failed", "failed", 60_000),
				run("waits", "awaiting_input", FAILED_WINDOW_MS * 4),
				run("fine", "succeeded", 1_000),
			],
			NOW,
		);
		expect(items.map((i) => [i.run.id, i.reason])).toEqual([
			["failed", "failed"],
			["waits", "waiting"],
		]);
	});

	it("names the product a run came from", () => {
		expect(productOfRun(run("a", "failed", 0, { kind: "import" }))).toBe(
			"datasets",
		);
		expect(productOfRun(run("b", "failed", 0, { task_id: "t1" }))).toBe(
			"projects",
		);
		expect(
			productOfRun(run("c", "failed", 0, { kind: "ql", agent_id: "a1" })),
		).toBe("explorer");
		expect(
			productOfRun(run("d", "failed", 0, { kind: "nl", agent_id: "a1" })),
		).toBe("agents");
		expect(productOfRun(run("e", "failed", 0, { kind: "nl" }))).toBe(
			"explorer",
		);
	});
});
