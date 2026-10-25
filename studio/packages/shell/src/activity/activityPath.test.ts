import { describe, expect, it } from "vitest";
import { activityOf, comparePath, runPagePath } from "./activityPath";

describe("activityOf", () => {
	it("reads a tab, and a schedule inside Schedules", () => {
		expect(activityOf("/u/admin/airways/activity/events")).toEqual({
			tab: "events",
		});
		expect(activityOf("/u/admin/airways/activity/schedules/s%201")).toEqual({
			tab: "schedules",
			scheduleId: "s 1",
		});
	});

	it("is null off Activity, on an unknown tab, or on a drill-in no tab has", () => {
		expect(activityOf("/u/admin/airways")).toBeNull();
		expect(activityOf("/u/admin/airways/activity/nope")).toBeNull();
		expect(activityOf("/u/admin/airways/activity/events/x")).toBeNull();
		expect(activityOf("/u/admin/airways/activity/runs/r1")).toBeNull();
	});

	it("reads a change's compare as Events, and refuses a kind that is not versioned", () => {
		const graph = { username: "admin", graphSlug: "airways" };
		const path = comparePath(graph, "plan", "answer nl", { a: "7", b: "8" });
		expect(path).toBe(
			"/u/admin/airways/activity/changes/plan/answer%20nl?a=7&b=8",
		);
		expect(activityOf(path.split("?")[0] as string)).toEqual({
			tab: "events",
			change: { kind: "plan", id: "answer nl" },
		});
		expect(activityOf("/u/admin/airways/activity/changes/board/x")).toBeNull();
	});

	it("opens a run on its Agents page", () => {
		expect(runPagePath({ username: "admin", graphSlug: "airways" }, "r 1")).toBe(
			"/u/admin/airways/agents/runs?page=run%3Ar%201",
		);
	});
});
