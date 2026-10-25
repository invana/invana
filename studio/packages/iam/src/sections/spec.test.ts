import { describe, expect, it } from "vitest";
import { panelOf, SECTIONS, sectionOfPanel } from "./spec";

describe("IAM panel keys", () => {
	it("round-trips every section through its prefixed panel key", () => {
		for (const key of Object.keys(SECTIONS) as (keyof typeof SECTIONS)[]) {
			expect(sectionOfPanel(panelOf(key))).toBe(key);
		}
	});

	it("reads another product's panel, or an unknown one, as none", () => {
		expect(sectionOfPanel("agents")).toBeNull();
		expect(sectionOfPanel("home")).toBeNull();
		expect(sectionOfPanel("iam-ledger")).toBeNull();
		expect(sectionOfPanel(null)).toBeNull();
	});
});
