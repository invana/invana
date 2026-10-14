import { describe, expect, it } from "vitest";
import { activityOf, activityPath, comparePath } from "./activityPath";

describe("activityOf", () => {
	it("reads a tab, and a run inside Runs", () => {
		expect(activityOf("/u/admin/airways/activity/events")).toEqual({
			tab: "events",
			runId: null,
		});
		expect(activityOf("/u/admin/airways/activity/runs/r%201")).toEqual({
			tab: "runs",
			runId: "r 1",
		});
	});

	it("is null off Activity, on an unknown tab, or on a drill-in no tab has", () => {
		expect(activityOf("/u/admin/airways")).toBeNull();
		expect(activityOf("/u/admin/airways/activity/nope")).toBeNull();
		expect(activityOf("/u/admin/airways/activity/events/x")).toBeNull();
	});

	it("reads a change's compare as Events, and refuses a kind that is not versioned", () => {
		const graph = { username: "admin", graphSlug: "airways" };
		const path = comparePath(graph, "plan", "answer nl", { a: "7", b: "8" });
		expect(path).toBe(
			"/u/admin/airways/activity/changes/plan/answer%20nl?a=7&b=8",
		);
		expect(activityOf(path.split("?")[0] as string)).toEqual({
			tab: "events",
			runId: null,
			change: { kind: "plan", id: "answer nl" },
		});
		expect(activityOf("/u/admin/airways/activity/changes/board/x")).toBeNull();
	});

	it("round-trips a run's path", () => {
		const path = activityPath(
			{ username: "admin", graphSlug: "airways" },
			"runs",
			"r 1",
		);
		expect(activityOf(path)).toEqual({ tab: "runs", runId: "r 1" });
	});
});
