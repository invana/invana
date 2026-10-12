import { describe, expect, it } from "vitest";
import { cronOf, cronWords, firesOn, nextIn, repeatOf } from "./cron";

// 2026-10-12 is a Monday.
const day = (d: number, m = 10) => new Date(2026, m - 1, d, 12, 0);

describe("cron as words", () => {
	it("says the four repeats and falls back to the cron", () => {
		expect(cronWords("0 7 * * *")).toBe("Daily 07:00");
		expect(cronWords("0 8 * * 1-5")).toBe("Weekdays 08:00");
		expect(cronWords("0 9 * * 1")).toBe("Mondays 09:00");
		expect(cronWords("0 9 * * 7")).toBe("Sundays 09:00");
		expect(cronWords("0 6 1 * *")).toBe("1st of the month 06:00");
		expect(cronWords("*/15 * * * *")).toBe("*/15 * * * *");
	});

	it("round-trips a Repeat through its cron", () => {
		for (const expr of ["30 7 * * *", "0 8 * * 1-5", "5 9 * * 3", "0 6 22 * *"])
			expect(cronOf(repeatOf(expr))).toBe(expr);
		expect(repeatOf("0 9 1-7 * 1").kind).toBe("custom");
	});
});

describe("firesOn", () => {
	it("reads lists, ranges and steps day by day", () => {
		expect(firesOn("0 8 * * 1-5", day(12))).toBe(true);
		expect(firesOn("0 8 * * 1-5", day(11))).toBe(false);
		expect(firesOn("0 9 * * 1,3", day(14))).toBe(true);
		expect(firesOn("0 6 */2 * *", day(13))).toBe(true);
		expect(firesOn("0 6 */2 * *", day(14))).toBe(false);
		expect(firesOn("0 6 1 1 *", day(1))).toBe(false);
	});

	it("matches either day field when both are restricted", () => {
		// The 15th, or any Monday.
		expect(firesOn("0 9 15 * 1", day(12))).toBe(true);
		expect(firesOn("0 9 15 * 1", day(15))).toBe(true);
		expect(firesOn("0 9 15 * 1", day(16))).toBe(false);
	});

	it("never fires for something that is not a cron", () => {
		expect(firesOn("every day", day(12))).toBe(false);
		expect(firesOn("0 25 * * *", day(12))).toBe(false);
	});
});

it("says how far off the next firing is", () => {
	const now = new Date("2026-10-12T10:00:00Z");
	expect(nextIn("2026-10-12T10:25:00Z", now)).toBe("next in 25 min");
	expect(nextIn("2026-10-13T00:00:00Z", now)).toBe("next in 14 h");
	expect(nextIn(null, now)).toBe("not due");
});
