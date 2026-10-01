import { describe, expect, it } from "vitest";
import { formatCompact, formatCompactCount, usd, usdWhole } from "./format";

describe("usd", () => {
	it("keeps a sub-cent cost visible and a true zero as $0", () => {
		expect(usd(0.0013)).toBe("$0.0013");
		expect(usd(0.00001)).toBe("<$0.0001");
		expect(usd(0)).toBe("$0");
		expect(usd(12.5)).toBe("$12.50");
	});
});

describe("usdWhole", () => {
	it("draws a budget in whole cents", () => {
		expect(usdWhole(5)).toBe("$5.00");
		expect(usdWhole(0.001)).toBe("$0.00");
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
