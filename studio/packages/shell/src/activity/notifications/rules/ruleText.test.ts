import { describe, expect, it } from "vitest";
import {
	audienceText,
	isSelfFeeding,
	matchText,
	RULE_EVENT_CATEGORIES,
} from "./ruleText";

describe("ruleText", () => {
	it("phrases the match and who hears", () => {
		expect(matchText({ status: "failed" })).toBe("has status failed");
		expect(matchText({})).toBe("any product");
		expect(
			audienceText(
				{ member_ids: ["u1"], roles: ["owner"], requester: true },
				() => "ravi",
			),
		).toBe("tells ravi, owners and whoever the run was for");
		expect(
			audienceText({ member_ids: [], roles: [], requester: false }, String),
		).toBe("tells nobody");
	});

	it("never offers an event a delivery writes", () => {
		const offered = RULE_EVENT_CATEGORIES.flatMap((c) =>
			c.types.map((t) => t.action),
		);
		expect(offered).toContain("run.finish");
		expect(offered.some(isSelfFeeding)).toBe(false);
		expect(offered).not.toContain("approval.remind");
	});
});
