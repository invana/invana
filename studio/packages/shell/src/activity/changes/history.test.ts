import { describe, expect, it } from "vitest";
import type { AuditEvent } from "../events/types";
import { changeOf, changeVerb, effectLine, snapshotName } from "./history";

const event = (over: Partial<AuditEvent>): AuditEvent => ({
	id: "e1",
	graph_id: "g1",
	actor: null,
	actor_kind: "user",
	actor_name: null,
	action: "agent.update",
	target_kind: "agent",
	target_id: "a1",
	details: {},
	trace_id: null,
	span_id: null,
	created_at: "2026-10-12T00:00:00Z",
	...over,
});

describe("changeOf", () => {
	it("reads a plan by its key, not its row id", () => {
		const e = event({
			action: "flow.promote",
			target_kind: "flow",
			target_id: "row-7",
			details: { key: "triage", version: 3 },
		});
		expect(changeOf(e)).toEqual({ kind: "plan", id: "triage", version: "3" });
	});

	it("labels a create without a version as the first", () => {
		const e = event({ action: "agent.create" });
		expect(changeOf(e)).toEqual({ kind: "agent", id: "a1", version: "1" });
	});

	it("is null for an event that mints no version", () => {
		expect(changeOf(event({ target_kind: "run" }))).toBeNull();
		expect(changeOf(event({ target_kind: "flow", details: {} }))).toBeNull();
	});
});

describe("a deleted record's row", () => {
	it("reads the event's name snapshot and the action in words", () => {
		const e = event({ details: { name: "Triage" } });
		expect(snapshotName(e, "agent")).toBe("Triage");
		expect(snapshotName(event({}), "model")).toBe("Unnamed model");
		expect(changeVerb("rule.create")).toBe("created");
		expect(changeVerb("agent.retire")).toBe("changed");
	});
});

describe("effectLine", () => {
	it("draws tokens, never currency", () => {
		const line = effectLine({
			basis: "pinned",
			runs: 2,
			failed: 1,
			tokens_in: 9_000,
			tokens_out: 3_000,
			tokens: 12_000,
			tokens_per_run: 6_000,
			since: null,
			until: null,
		});
		expect(line).toBe("2 runs · 1 failed · 12k tokens");
	});
});
