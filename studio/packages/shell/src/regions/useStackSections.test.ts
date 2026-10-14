import { describe, expect, it } from "vitest";
import { sectionOf, withSection } from "./useStackSections";

const SECTIONS = ["plans", "catalogue", "templates"] as const;
const url = (q: string) => new URLSearchParams(q);

describe("a stacked panel's section key", () => {
	it("opens on ?section=, and on an older ?drawer= link", () => {
		expect(sectionOf(url("panel=library&section=catalogue"), SECTIONS)).toBe(
			"catalogue",
		);
		expect(sectionOf(url("panel=library&drawer=templates"), SECTIONS)).toBe(
			"templates",
		);
	});

	it("falls back to the first section for a missing or unknown value", () => {
		expect(sectionOf(url("panel=library"), SECTIONS)).toBe("plans");
		expect(sectionOf(url("panel=library&section=runs"), SECTIONS)).toBe(
			"plans",
		);
	});

	it("writes ?section= and drops ?drawer=, keeping every other key", () => {
		const next = withSection(
			url("panel=library&drawer=plans&plan=nl-single"),
			"catalogue",
		);
		expect(next.toString()).toBe(
			"panel=library&plan=nl-single&section=catalogue",
		);
	});
});
