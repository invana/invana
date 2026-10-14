import { describe, expect, it } from "vitest";
import { formatCompact, formatCompactCount } from "./format";

describe("formatCompact", () => {
	it("reads a magnitude, dropping a trailing .0", () => {
		expect(formatCompact(820)).toBe("820");
		expect(formatCompact(8214)).toBe("8.2k");
		expect(formatCompact(3000)).toBe("3k");
		expect(formatCompact(1_400_000)).toBe("1.4m");
	});
});

describe("formatCompactCount", () => {
	it("is always in k, with fewer decimals as it grows", () => {
		expect(formatCompactCount(250_000)).toBe("250k");
		expect(formatCompactCount(15_000)).toBe("15k");
		expect(formatCompactCount(300)).toBe("0.3k");
	});
});
