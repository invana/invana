import { describe, expect, it } from "vitest";
import { sampleRatio } from "./sampling";

describe("sampleRatio", () => {
	it("keeps a ratio between 0 and 1", () => {
		expect(sampleRatio("0.25")).toBe(0.25);
		expect(sampleRatio("0")).toBe(0);
		expect(sampleRatio("1")).toBe(1);
	});

	it("keeps every trace when the value is missing or invalid", () => {
		for (const raw of [undefined, "", "abc", "2", "-0.1"]) {
			expect(sampleRatio(raw)).toBe(1);
		}
	});
});
