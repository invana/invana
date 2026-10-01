import { describe, expect, it } from "vitest";
import type { TouchesResponse } from "@/pages/graphs-detail/features/lenses";
import type { TraceRead } from "@/pages/graphs-detail/features/runs/api";
import { planKeyOf, runSummary } from "./runSummary";

const trace = (over: Partial<TraceRead> = {}) =>
	({
		workflow_key: "ql-direct",
		plan_origin: "template:nl-compare@3",
		plan_revision: null,
		triggered_by: null,
		ask_kind: "ql",
		body: "MATCH (n) RETURN n",
		agent_id: null,
		lens_name: null,
		lens_ref: null,
		opened_by: "admin",
		trace_id: "abc123",
		started_at: "2026-09-28T10:00:00Z",
		finished_at: "2026-09-28T10:00:05Z",
		duration_ms: 5000,
		cost_usd: 0.0013,
		tokens_in: 8200,
		tokens_out: 400,
		governed: true,
		clarifications: 2,
		replans: 1,
		budget: { max_cost_usd_run: 1, max_clarifications: 2, max_replans: 1 },
		steps: [
			{
				seq: 1,
				status: "succeeded",
				duration_ms: 1000,
				attempt: 3,
				max_attempts: 3,
				task_key: "graph_read",
				step_key: "read",
			},
		],
		...over,
	}) as unknown as TraceRead;

const touches = {
	items: [
		{
			layer: "graph_data",
			direction: "read",
			volume: { rows: 15 },
			address: "graph_data/model/x",
		},
		{
			layer: "llm",
			direction: "refused",
			volume: {},
			address: "llm/provider/gpt",
			rule_matched: "No OpenAI",
		},
		{ layer: "cache", direction: "skipped", volume: {}, address: "cache/q/x" },
	],
} as unknown as TouchesResponse;

describe("runSummary", () => {
	it("draws a finished, governed run: plan, cost, touches and spent bounds", () => {
		const s = runSummary(trace(), touches);
		const row = (label: string) =>
			[...s.theRun, ...s.cost, ...s.bounds].find((r) => r.label === label)
				?.value;
		expect(row("plan")).toBe("nl-compare@3");
		expect(row("asked")).toBe("MATCH (n) RETURN n");
		expect(row("opened by")).toBe("admin · a session message");
		expect(row("elapsed")).toBe("5.0s");
		expect(row("cost")).toBe("$0.0013 of $1.00");
		expect(row("tokens")).toBe("8.2k in · 400 out");
		expect(row("waiting")).toBe("4.0s");
		expect(row("rounds")).toBe("3 of 3");
		expect(s.boundsAside).toBe("3 exhausted");
		expect(s.work).toBe("1.0s of work");
		const note = (layer: string) => s.touched.find((t) => t.layer === layer);
		expect(note("graph_data")?.note).toBe("15 rows");
		expect(note("llm")).toMatchObject({ note: "refused", refused: true });
		expect(note("cache")).toMatchObject({ note: "miss", dim: true });
		expect(s.refused).toEqual([
			{ address: "llm/provider/gpt", why: "Denied by No OpenAI." },
		]);
	});

	it("says a live, ungoverned run is still going and touched nothing", () => {
		const s = runSummary(
			trace({
				finished_at: null,
				duration_ms: 65_000,
				governed: false,
				plan_origin: "generated",
				triggered_by: "schedule",
				opened_by: null,
				budget: null,
				cost_usd: null,
				tokens_in: 0,
				tokens_out: 0,
				steps: [],
			} as unknown as Partial<TraceRead>),
			undefined,
		);
		const row = (label: string) =>
			s.theRun.find((r) => r.label === label)?.value;
		expect(row("plan")).toBe("ql-direct · planned");
		expect(row("opened by")).toBe("a schedule");
		expect(row("elapsed")).toBe("1m 5s so far");
		expect(s.touched).toEqual([]);
		expect(s.boundsAside).toBeNull();
		expect(s.work).toBeNull();
	});

	it("names how a run was opened, and who ran it", () => {
		const opened = (over: object) =>
			runSummary(
				trace({ opened_by: null, ...over } as Partial<TraceRead>),
				undefined,
			).theRun.find((r) => r.label === "opened by")?.value;
		expect(opened({ triggered_by: "task" })).toBe("a task");
		expect(opened({ triggered_by: "delegation" })).toBe("a delegation");
		expect(opened({ ask_kind: "import" })).toBe("an import");
		const s = runSummary(
			trace({
				agent_id: "ag1",
				lens_name: "EU only",
				plan_origin: null,
				plan_revision: "7",
				body: "  ",
				cost_usd: 0,
				budget: { max_replans: 2 },
				replans: 1,
				steps: [
					{
						seq: 1,
						status: "needs_input",
						finished_at: "2026-09-28T10:00:01Z",
						started_at: "2026-09-28T10:00:00Z",
						attempt: 1,
						max_attempts: 1,
						task_key: "ask",
					},
					{
						seq: 2,
						status: "succeeded",
						started_at: "2026-09-28T10:00:03Z",
						duration_ms: 500,
						attempt: 1,
						max_attempts: 2,
						task_key: "graph_read",
					},
				],
			} as unknown as Partial<TraceRead>),
			{
				items: [
					{ layer: "llm", direction: "call", volume: {}, address: "llm/x" },
					{
						layer: "human",
						direction: "refused",
						volume: {},
						address: "human/y",
					},
				],
			} as unknown as TouchesResponse,
			"Atlas",
		);
		const row = (label: string) =>
			[...s.theRun, ...s.cost, ...s.bounds].find((r) => r.label === label)
				?.value;
		expect(row("agent")).toBe("Atlas");
		expect(row("lens")).toBe("EU only");
		expect(row("plan")).toBe("ql-direct@7");
		expect(row("asked")).toBeUndefined();
		expect(row("cost")).toBe("$0");
		expect(row("waiting")).toBe("4.5s — 2.0s asking");
		expect(row("attempts")).toBe("1 of 2 · graph_read");
		expect(row("replans")).toBe("1 of 2");
		expect(s.boundsAside).toBe("none exhausted");
		expect(s.touched.find((t) => t.layer === "llm")?.note).toBe("1 call");
		expect(s.touched.find((t) => t.layer === "agent")?.note).toBe(
			"not touched",
		);
		expect(s.refused).toEqual([
			{ address: "human/y", why: "Denied by a guardrail." },
		]);
	});

	it("names a plan key only for a template or a promoted plan", () => {
		expect(planKeyOf(trace())).toBe("nl-compare");
		expect(planKeyOf(trace({ plan_origin: "generated" }))).toBeNull();
	});
});
