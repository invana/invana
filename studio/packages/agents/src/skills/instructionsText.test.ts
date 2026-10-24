import { describe, expect, it } from "vitest";
import {
	addFunctionLines,
	lineOf,
	newSkillContent,
	replaceLine,
} from "./instructionsText";

const TEXT = newSkillContent("fare-freshness").replace(
	"## Steps\n\n",
	"## Steps\n1. List the hub's routes.\n",
);

describe("instructionsText", () => {
	it("opens a new skill on the four headings", () => {
		const text = newSkillContent("untitled");
		for (const h of [
			"# untitled",
			"## Goal",
			"## Arguments",
			"## Steps",
			"## When things go wrong",
		])
			expect(text).toContain(h);
	});

	it("finds the line a span reads on, and none for a span that is gone", () => {
		expect(lineOf(TEXT, "List the hub's routes.")).toBe(10);
		expect(lineOf(TEXT, "1. List the hub's routes. Then more")).toBe(10);
		expect(lineOf(TEXT, "Email the manager")).toBeNull();
		expect(lineOf(TEXT, null)).toBeNull();
	});

	it("writes a step line under ## Steps, once per function", () => {
		const out = addFunctionLines(TEXT, ["web.search", "web.search"]);
		const lines = out.split("\n");
		expect(lines[10]).toBe("- Use web.search to …");
		expect(lines.indexOf("## When things go wrong")).toBeGreaterThan(10);
		expect(addFunctionLines(out, ["web.search"])).toBe(out);
		expect(addFunctionLines("# x", ["a.b"])).toContain("## Steps\n- Use a.b");
	});

	it("replaces one line and ignores a line out of range", () => {
		expect(replaceLine("a\nb", 2, "c")).toBe("a\nc");
		expect(replaceLine("a\nb", 5, "c")).toBe("a\nb");
	});
});
