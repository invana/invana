import type { TaskRunSummary } from "@invana-studio/core";
import { describe, expect, it } from "vitest";
import type { Approval, Notification } from "../notifications/types";
import { inboxCount, inboxOf, productOfRun } from "./inbox";

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
		duration_ms: null,
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

function note(id: string, agoMs: number, read: boolean): Notification {
	return {
		id,
		kind: "event",
		title: id,
		body: "",
		event_id: null,
		rule_id: null,
		approval_id: null,
		schedule_id: null,
		run_id: null,
		target_kind: "skill",
		target_id: null,
		read_at: read ? new Date(NOW).toISOString() : null,
		created_at: new Date(NOW - agoMs).toISOString(),
	};
}

const approval = {
	id: "ap1",
	status: "pending",
	deadline_at: new Date(NOW + 60_000).toISOString(),
} as Approval;

describe("inboxOf", () => {
	it("puts approvals first, then waiting runs, then notifications newest first", () => {
		const items = inboxOf(
			[approval],
			[run("waits", "awaiting_input", 5_000), run("failed", "failed", 1_000)],
			[note("old", 90_000, true), note("new", 1_000, false)],
		);
		expect(items.map((i) => i.id)).toEqual([
			"approval:ap1",
			"run:waits",
			"notification:new",
			"notification:old",
		]);
		// A failed run reaches the Inbox only as a rule's notification.
		expect(items.some((i) => i.id === "run:failed")).toBe(false);
		// A read notification is listed but not counted.
		expect(inboxCount(items)).toBe(3);
	});

	it("shows a run held on an approval once, as the approval", () => {
		const items = inboxOf(
			[{ ...approval, run_id: "held" }],
			[run("held", "awaiting_input", 5_000)],
			[],
		);
		expect(items.map((i) => i.id)).toEqual(["approval:ap1"]);
		expect(inboxCount(items)).toBe(1);
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
