import { describe, expect, it } from "vitest";
import { formatCompact, formatCompactCount, formatGrouped } from "./format";

describe("formatGrouped", () => {
	it("prints the whole count, grouped, never a magnitude", () => {
		expect(formatGrouped(999)).toBe("999");
		expect(formatGrouped(8314)).toBe((8314).toLocaleString());
		expect(formatGrouped(8314)).not.toBe("8.3k");
	});
});

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
