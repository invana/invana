import { describe, expect, it } from "vitest";
import { changesOf, draftOf, effortSummary, voiceSummary } from "./agentDraft";
import type { Agent } from "./types";

const agent = {
	instructions: "Be brief.",
	budget: { max_cost_usd_run: 1 },
	effort: { max_steps: 16 },
	policy: {},
	workflow_spec: { allow: ["graph_read"] },
	soul: "",
	soul_traits: {},
} as unknown as Agent;

describe("changesOf", () => {
	it("sends only what moved", () => {
		const draft = draftOf(agent);
		draft.effort.max_steps = 8;
		draft.spec.allow?.push("llm_call");
		expect(changesOf(agent, draft)).toEqual({
			effort: { max_steps: 8 },
			workflow_spec: { allow: ["graph_read", "llm_call"] },
		});
	});

	it("sends nothing for an untouched draft", () => {
		expect(changesOf(agent, draftOf(agent))).toEqual({});
	});
});

describe("summaries", () => {
	it("reads the dials, defaults filled in", () => {
		expect(voiceSummary({})).toBe(
			"light humour · neutral · no emoji · no greeting",
		);
		expect(voiceSummary({ humour: "off", emoji: "on", greeting: "on" })).toBe(
			"no humour · neutral · emoji · greets",
		);
	});

	it("reads effort in words, singular for one", () => {
		expect(
			effortSummary({ max_steps: 16, max_replans: 1, max_clarifications: 3 }),
		).toBe("16 steps · 1 replan · 3 questions");
	});
});
