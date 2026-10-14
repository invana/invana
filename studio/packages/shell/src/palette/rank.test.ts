import { describe, expect, it } from "vitest";
import { matchRank, rankByName } from "./rank";

describe("rankByName", () => {
	const items = [
		{ label: "Heathrow lounge" },
		{ label: "airport lounge" },
		{ label: "airport" },
		{ label: "Routes out of LHR", keywords: ["lhr"] },
	];

	it("puts exact names first, then prefixes, then words, then the rest", () => {
		expect(rankByName("airport", items).map((i) => i.label)).toEqual([
			"airport",
			"airport lounge",
		]);
		expect(rankByName("lounge", items).map((i) => i.label)).toEqual([
			"airport lounge",
			"Heathrow lounge",
		]);
		expect(matchRank("LHR", items[3])).toBe(0);
		expect(matchRank("row", items[0])).toBe(3);
	});

	it("drops what does not match, and an empty query matches nothing", () => {
		expect(rankByName("tweet", items)).toEqual([]);
		expect(rankByName("  ", items)).toEqual([]);
	});
});
