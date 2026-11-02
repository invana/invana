import { describe, expect, it } from "vitest";
import {
	ACTIVITY_SECTIONS,
	type ActivitySectionKey,
	activityPanelOf,
	activitySectionOfPanel,
} from "./sections";

describe("Activity panel keys", () => {
	it("round-trips every section through its prefixed panel key", () => {
		for (const key of Object.keys(ACTIVITY_SECTIONS) as ActivitySectionKey[]) {
			expect(activitySectionOfPanel(activityPanelOf(key))).toBe(key);
		}
	});

	it("reads another product's panel, or an unknown one, as none", () => {
		expect(activitySectionOfPanel("runs")).toBeNull();
		expect(activitySectionOfPanel("iam-agents")).toBeNull();
		expect(activitySectionOfPanel("activity-toString")).toBeNull();
		expect(activitySectionOfPanel(null)).toBeNull();
	});
});
