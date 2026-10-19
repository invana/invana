import { describe, expect, it } from "vitest";
import { edgeAlpha, edgesThinned, MIN_EDGE_ALPHA } from "./edgeDensity";

describe("edge density", () => {
	it("draws a small result solid and a dense one faint, never invisible", () => {
		expect(edgeAlpha(150)).toBe(1);
		expect(edgeAlpha(2500)).toBeCloseTo(0.283, 2);
		expect(edgeAlpha(1_000_000)).toBe(MIN_EDGE_ALPHA);
	});

	it("thins only a large result, and only zoomed out", () => {
		expect(edgesThinned(2500, 0.14)).toBe(true);
		expect(edgesThinned(2500, 0.9)).toBe(false);
		expect(edgesThinned(120, 0.14)).toBe(false);
	});
});
