import { describe, expect, it } from "vitest";
import { canonicalRedirect, pageParamsOf } from "./panelPaths";

const G = "/u/admin/airways";

describe("panelPaths", () => {
	it("reads a path as the panel, its section and its drill-in", () => {
		const params = pageParamsOf("agents/llms/openai", "page=run%3A1");
		expect(params.get("panel")).toBe("agents");
		expect(params.get("section")).toBe("llms");
		expect(params.get("provider")).toBe("openai");
		expect(params.get("page")).toBe("run:1");
	});

	it("sends every old ?panel= link to its path, keeping the rest", () => {
		expect(canonicalRedirect(G, "?panel=runs&run=r1&right=assistant")).toBe(
			`${G}/activity/runs/r1?right=assistant`,
		);
		expect(
			canonicalRedirect(G, "?settings=library&drawer=catalogue&entry=k"),
		).toBe(`${G}/agents/plugins/tasks/k`);
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

	it("gives each Agents rail item its own path", () => {
		expect(canonicalRedirect(`${G}/agents`, "")).toBe(`${G}/agents/agents`);
		expect(pageParamsOf("agents/settings", "").get("panel")).toBe(
			"concurrency",
		);
		const template = pageParamsOf("agents/library/templates/t1", "");
		expect(template.get("section")).toBe("templates");
		expect(template.get("template")).toBe("t1");
		expect(canonicalRedirect(`${G}/agents/plugins`, "")).toBeNull();
		expect(canonicalRedirect(G, "?panel=llms")).toBe(`${G}/agents/llms`);
	});

	it("drops a panel key that names nothing", () => {
		expect(canonicalRedirect(G, "?panel=tasks&page=x")).toBe(`${G}?page=x`);
		expect(canonicalRedirect("/graphs", "?panel=runs")).toBeNull();
	});
});
