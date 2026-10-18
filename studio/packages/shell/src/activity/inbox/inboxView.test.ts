import { describe, expect, it } from "vitest";
import type { Approval, Notification } from "../notifications/types";
import type { InboxItem } from "./inbox";
import {
	effectOf,
	filterInbox,
	nextStepOf,
	payloadSections,
	timeLeft,
} from "./inboxView";

const NOW = Date.parse("2026-10-11T12:00:00Z");

function note(extra: Partial<Notification> = {}): Notification {
	return {
		id: "n1",
		kind: "event",
		title: "t",
		body: "",
		event_id: null,
		rule_id: null,
		approval_id: null,
		schedule_id: null,
		run_id: null,
		target_kind: null,
		target_id: null,
		read_at: null,
		created_at: new Date(NOW).toISOString(),
		...extra,
	};
}

const approval = {
	id: "a1",
	status: "pending",
	deadline_at: new Date(NOW + 5 * 3_600_000).toISOString(),
} as Approval;

describe("the Inbox view", () => {
	it("Unread keeps approvals and drops read notifications; a product drops the rest", () => {
		const items: InboxItem[] = [
			{ kind: "approval", id: "a", at: 0, approval },
			{
				kind: "notification",
				id: "read",
				at: 0,
				notification: note({ read_at: "x" }),
				product: "agents",
				unread: false,
			},
			{
				kind: "notification",
				id: "new",
				at: 0,
				notification: note(),
				product: "datasets",
				unread: true,
			},
		];
		const unread = filterInbox(items, { product: null, unreadOnly: true });
		expect(unread.map((i) => i.id)).toEqual(["a", "new"]);
		const agents = filterInbox(items, { product: "agents", unreadOnly: false });
		expect(agents.map((i) => i.id)).toEqual(["read"]);
	});

	it("a notification opens its pending approval first, then its run or schedule target", () => {
		expect(
			nextStepOf(note({ approval_id: "a1", run_id: "r" }), true, [approval])
				.kind,
		).toBe("review");
		// A decided approval has left the Inbox: the run is next.
		expect(
			nextStepOf(note({ approval_id: "a1", run_id: "r" }), true, []),
		).toEqual({
			kind: "run",
			id: "r",
		});
		expect(
			nextStepOf(note({ target_kind: "schedule", target_id: "s" }), true, []),
		).toEqual({ kind: "schedule", id: "s" });
		expect(nextStepOf(note(), false, []).kind).toBe("none");
	});

	it("reads a held delivery's payload channel by channel, and a past deadline as none", () => {
		const sections = payloadSections({
			channels: [
				{
					channel: "ops",
					kind: "email",
					target: "a@x.io",
					payload: { subject: "Brief", text: "Body" },
				},
			],
		});
		expect(sections).toEqual([
			{
				heading: "ops · email",
				rows: [
					{ label: "To", value: "a@x.io" },
					{ label: "Subject", value: "Brief" },
					{ label: "Text", value: "Body" },
				],
			},
		]);
		expect(timeLeft(approval.deadline_at, NOW)).toBe("5 h");
		expect(timeLeft(new Date(NOW - 1).toISOString(), NOW)).toBeNull();
	});

	it("says what each choice does for a held agent step, and that declining sends nothing", () => {
		expect(effectOf("step").approve).toMatch(/run carries on/);
		expect(effectOf("step").decline).toMatch(/Nothing is sent/);
		expect(effectOf("model_publish").decline).toMatch(/unpublished/);
	});
});
