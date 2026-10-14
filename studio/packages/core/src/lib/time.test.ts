import { describe, expect, it } from "vitest";
import { formatDuration, formatElapsed, formatRelativeTime } from "./time";

describe("formatDuration", () => {
	it("reads a step in ms under a second and in seconds after", () => {
		expect(formatDuration(840)).toBe("840ms");
		expect(formatDuration(1200)).toBe("1.2s");
		expect(formatDuration(12_400)).toBe("12s");
	});

	it("never draws zero — a sub-millisecond step is <1ms", () => {
		expect(formatDuration(0)).toBe("<1ms");
	});
});

describe("formatElapsed", () => {
	it("reads a run in minutes and hours, not in seconds", () => {
		expect(formatElapsed(840)).toBe("840ms");
		expect(formatElapsed(14_000)).toBe("14s");
		expect(formatElapsed(125_000)).toBe("2m 5s");
		expect(formatElapsed(4_320_000)).toBe("1h 12m");
	});
});

describe("formatRelativeTime", () => {
	const ago = (ms: number) => new Date(Date.now() - ms);

	it("names the unit, singular and plural", () => {
		expect(formatRelativeTime(ago(10_000))).toBe("just now");
		expect(formatRelativeTime(ago(60_000))).toBe("1 min ago");
		expect(formatRelativeTime(ago(5 * 60_000))).toBe("5 mins ago");
		expect(formatRelativeTime(ago(3_600_000))).toBe("1 hr ago");
		expect(formatRelativeTime(ago(2 * 86_400_000))).toBe("2 days ago");
	});

	it("falls back to a date past a week", () => {
		const old = ago(30 * 86_400_000);
		expect(formatRelativeTime(old)).toBe(old.toLocaleDateString());
	});
});
