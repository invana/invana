import { describe, expect, it } from "vitest";
import { canonicalRedirect, pageParamsOf } from "./panelPaths";

const G = "/u/admin/airways";

describe("panelPaths", () => {
	it("reads a path as the panel, its section and its drill-in", () => {
		const params = pageParamsOf("agents/llms/openai", "page=run%3A1");
		expect(params.get("panel")).toBe("llms");
		expect(params.get("provider")).toBe("openai");
		expect(params.get("page")).toBe("run:1");
	});

	it("sends every old ?panel= link to its path, keeping the rest", () => {
		expect(canonicalRedirect(G, "?panel=runs&right=assistant")).toBe(
			`${G}/activity/runs?right=assistant`,
		);
		expect(canonicalRedirect(G, "?settings=functions&drawer=templates")).toBe(
			`${G}/agents/functions/templates`,
		);
		expect(canonicalRedirect(G, "?panel=info")).toBe(`${G}/modeller/settings`);
		expect(canonicalRedirect(G, "?panel=sessions")).toBe(
			`${G}/explorer?right=assistant`,
		);
		expect(canonicalRedirect(`${G}/modeller`, "")).toBe(
			`${G}/modeller/global-model`,
		);
	});

	it("leaves a canonical URL alone, whatever its key order", () => {
		expect(canonicalRedirect(`${G}/agents/agents`, "?provider=p")).toBeNull();
		expect(
			canonicalRedirect(
				`${G}/modeller/settings`,
				"?right=assistant&tab=members",
			),
		).toBeNull();
		expect(canonicalRedirect(G, "")).toBeNull();
		expect(
			canonicalRedirect(`${G}/activity/changes/agent/a1`, "?a=1&b=2"),
		).toBeNull();
	});

	it("keeps each Modeller reading of the Model panel on its own path", () => {
		expect(canonicalRedirect(G, "?panel=model")).toBe(
			`${G}/modeller/global-model`,
		);
		expect(canonicalRedirect(`${G}/modeller/models`, "?model=m1")).toBeNull();
		expect(pageParamsOf("modeller/stitches", "").get("section")).toBe(
			"stitches",
		);
	});

	it("gives each Agents section, and each of its tabs, its own path", () => {
		expect(canonicalRedirect(`${G}/agents`, "")).toBe(`${G}/agents/home`);
		expect(pageParamsOf("agents/settings", "").get("panel")).toBe(
			"concurrency",
		);
		const map = pageParamsOf("agents/fleet/map", "");
		expect(map.get("panel")).toBe("fleet");
		expect(map.get("section")).toBe("map");
		expect(canonicalRedirect(`${G}/agents/fleet`, "")).toBeNull();
		expect(canonicalRedirect(`${G}/agents/connections`, "")).toBe(
			`${G}/agents/connections/server`,
		);
		expect(canonicalRedirect(G, "?panel=llms")).toBe(`${G}/agents/llms`);
		expect(canonicalRedirect(G, "?panel=llms&provider=openai")).toBe(
			`${G}/agents/llms/openai`,
		);
	});

	it("lands IAM on Home and keeps its panels apart from Agents'", () => {
		expect(canonicalRedirect(`${G}/iam`, "")).toBe(`${G}/iam/home`);
		expect(pageParamsOf("iam/agents", "").get("panel")).toBe("iam-agents");
		expect(pageParamsOf("agents/agents", "").get("panel")).toBe("agents");
		expect(
			canonicalRedirect(`${G}/iam/policies`, "page=policy%3Aread-only"),
		).toBeNull();
		expect(canonicalRedirect(G, "?panel=iam-settings")).toBe(
			`${G}/iam/settings`,
		);
	});

	it("gives each Activity section, and each of its tabs, its own path", () => {
		expect(canonicalRedirect(`${G}/activity`, "")).toBe(`${G}/activity/runs`);
		expect(pageParamsOf("activity/runs", "").get("panel")).toBe(
			"activity-runs",
		);
		const actor = pageParamsOf("activity/ledger/actor", "");
		expect(actor.get("panel")).toBe("activity-ledger");
		expect(actor.get("section")).toBe("actor");
		expect(pageParamsOf("activity/schedules/s1", "").get("schedule")).toBe(
			"s1",
		);
		expect(canonicalRedirect(`${G}/activity/approvals/alerts`, "")).toBeNull();
		expect(canonicalRedirect(G, "?panel=approvals&section=alerts")).toBe(
			`${G}/activity/approvals/alerts`,
		);
		expect(canonicalRedirect(G, "?panel=activity&section=inbox")).toBe(
			`${G}/activity/inbox`,
		);
		expect(canonicalRedirect(`${G}/agents/runs`, "")).toBe(G);
	});

	it("reads a change's compare as Events, and the bare change log as its filter", () => {
		const change = pageParamsOf("activity/changes/plan/answer%20nl", "a=1");
		expect(change.get("panel")).toBe("activity-events");
		expect(change.get("change")).toBe("plan/answer nl");
		expect(canonicalRedirect(`${G}/activity/changes`, "")).toBe(
			`${G}/activity/events?filter=changes`,
		);
	});

	it("puts a project under the Projects root and Decisions beside My todos", () => {
		const project = pageParamsOf("projects/p1", "");
		expect(project.get("section")).toBe("projects");
		expect(project.get("project")).toBe("p1");
		expect(pageParamsOf("projects/todos/t1", "").get("todo")).toBe("t1");
		expect(pageParamsOf("projects/decisions", "").get("panel")).toBe(
			"decisions",
		);
	});

	it("drops a panel key that names nothing", () => {
		expect(canonicalRedirect(G, "?panel=tasks&page=x")).toBe(`${G}?page=x`);
		expect(canonicalRedirect("/graphs", "?panel=runs")).toBeNull();
	});
});
