import { describe, expect, it } from "vitest";
import { matchesEventSearch } from "./eventSearch";
import type { AuditEvent } from "./types";

const event = {
	action: "rule.created",
	actor: { username: "ada", display_name: "Ada Lovelace" },
	actor_kind: "user",
	target_kind: "rule",
	target_id: "r1",
	details: { name: "No PII" },
} as unknown as AuditEvent;

describe("matchesEventSearch", () => {
	it("matches the actor, the action or the payload, case-blind", () => {
		expect(matchesEventSearch(event, "LOVELACE")).toBe(true);
		expect(matchesEventSearch(event, "rule.created")).toBe(true);
		expect(matchesEventSearch(event, "no pii")).toBe(true);
		expect(matchesEventSearch(event, "  ")).toBe(true);
	});

	it("misses what the event does not carry", () => {
		expect(matchesEventSearch(event, "guardrail")).toBe(false);
	});
});
