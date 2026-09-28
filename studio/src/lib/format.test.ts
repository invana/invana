import { describe, expect, it } from "vitest";
import { usd, usdWhole } from "./format";

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
