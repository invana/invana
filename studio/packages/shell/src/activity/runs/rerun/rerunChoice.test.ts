import { describe, expect, it } from "vitest";
import { isRerunnable, rerunChoices } from "./rerunChoice";

describe("rerun choice", () => {
	it("offers a settled root ask, on the same versions it recorded", () => {
		expect(isRerunnable({ status: "succeeded", askKind: "ql" })).toBe(true);
		expect(rerunChoices("nl", "claude-x-2026-01-01")).toEqual({
			sameDisabled: null,
			initial: "same",
		});
	});

	it("refuses a step or a live run, and an nl run that recorded no model", () => {
		expect(
			isRerunnable({ status: "succeeded", askKind: "nl", parentRunId: "r1" }),
		).toBe(false);
		expect(isRerunnable({ status: "running", askKind: "nl" })).toBe(false);
		const choices = rerunChoices("nl", null);
		expect(choices.sameDisabled).toBeTruthy();
		expect(choices.initial).toBe("current");
	});
});
