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
		expect(canonicalRedirect(G, "?panel=runs&run=r1&right=assistant")).toBe(
			`${G}/activity/runs/r1?right=assistant`,
		);
		expect(canonicalRedirect(G, "?settings=functions&drawer=templates")).toBe(
			`${G}/agents/functions/templates`,
		);
		expect(canonicalRedirect(G, "?panel=info")).toBe(
			`${G}/modeller/settings?tab=info`,
		);
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
			canonicalRedirect(`${G}/modeller/settings`, "?right=assistant&tab=info"),
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
			`${G}/agents/connections/mcp`,
		);
		expect(canonicalRedirect(G, "?panel=llms")).toBe(`${G}/agents/llms`);
		expect(canonicalRedirect(G, "?panel=llms&provider=openai")).toBe(
			`${G}/agents/llms/openai`,
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
