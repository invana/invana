import { beforeEach, describe, expect, it } from "vitest";
import { useRunStore } from "./run.store";

const step = (seq: number, status: string, extra: object = {}) => ({
	step_id: `s${seq}`,
	seq,
	task_key: "graph_read",
	label: `Step ${seq}`,
	status,
	...extra,
});

describe("run store", () => {
	beforeEach(() => useRunStore.setState({ views: {} }));

	it("folds a run's stream into one view, in seq order", () => {
		const { seed, apply } = useRunStore.getState();
		seed({ id: "r1", sessionId: "s", messageId: "m" });
		apply("r1", { seq: 1, kind: "run.started", payload: { workflow: "ql" } });
		apply("r1", { seq: 3, kind: "step.started", payload: step(2, "running") });
		apply("r1", { seq: 2, kind: "step.started", payload: step(1, "running") });
		apply("r1", {
			seq: 4,
			kind: "step.finished",
			payload: step(1, "succeeded"),
		});
		apply("r1", {
			seq: 5,
			kind: "emission",
			payload: {
				id: "e1",
				seq: 1,
				kind: "metric",
				payload: { value: 42, label: "routes" },
				citation: { record_count: 3 },
			},
		});
		apply("r1", { seq: 6, kind: "run.done", payload: { status: "succeeded" } });

		const view = useRunStore.getState().views.r1;
		expect(view.status).toBe("succeeded");
		expect(view.workflow).toBe("ql");
		// seq 2 arrived after seq 3, so it was dropped as stale.
		expect(view.steps.map((s) => [s.id, s.status])).toEqual([
			["s1", "succeeded"],
			["s2", "running"],
		]);
		expect(view.emissions?.[0]).toMatchObject({
			kind: "metric",
			value: "42",
			citation: { recordCount: 3 },
		});
	});

	it("records a question, a cannot-answer and a cancel as themselves", () => {
		const { seed, apply, remove } = useRunStore.getState();
		seed({ id: "r2", sessionId: "s", messageId: "m" });
		apply("r2", {
			seq: 1,
			kind: "clarification.requested",
			payload: { question: "Which airport?", options: ["MMK"] },
		});
		expect(useRunStore.getState().views.r2).toMatchObject({
			status: "awaiting_input",
			clarification: { question: "Which airport?", options: ["MMK"] },
		});
		apply("r2", {
			seq: 2,
			kind: "cannot_answer",
			payload: { reason: "no Deals" },
		});
		apply("r2", { seq: 3, kind: "run.cancelled", payload: {} });
		expect(useRunStore.getState().views.r2).toMatchObject({
			status: "cancelled",
			cannotAnswer: { reason: "no Deals" },
		});
		remove("r2");
		expect(useRunStore.getState().views.r2).toBeUndefined();
	});

	it("keeps what only rides the stream: reasoning, the query, retries and every emission kind", () => {
		const { seed, apply } = useRunStore.getState();
		seed({ id: "r3", sessionId: "s", messageId: "m" });
		const frames: [string, Record<string, unknown>][] = [
			["step.started", step(1, "running")],
			["step.progress", { step_id: "s1", detail: "12 rows" }],
			["step.retrying", { ...step(1, "retrying"), reason: "timeout" }],
			["reasoning", { text: "compare two airports" }],
			["query.proposed", { query: "MATCH (a) RETURN a", language: "cypher" }],
			[
				"result",
				{ result: { result_type: "tabular", rows: [], row_count: 0 } },
			],
			["diagnosis", { stage: "execute", message: "timed out" }],
			["something.new", {}],
		];
		frames.forEach(([kind, payload], i) => {
			apply("r3", { seq: i + 1, kind, payload });
		});
		const kinds = [
			["subgraph", { data: { nodes: [], edges: [] }, on_canvas: true }],
			["chart", { caption: "by month", series: [] }],
			["prose", { text: "Two routes." }],
			["empty", { statement: "Nothing held." }],
			["table", { rows: [{ n: 1 }] }],
			["metric", {}],
		] as const;
		kinds.forEach(([kind, payload], i) => {
			apply("r3", {
				seq: 20 + i,
				kind: "emission",
				payload: {
					id: `e${i}`,
					seq: kinds.length - i,
					kind,
					payload,
					citation: {},
					templates: [
						{ template_id: "t", name: "T", surface: "card", available: true },
					],
				},
			});
		});

		const view = useRunStore.getState().views.r3;
		expect(view.steps[0]).toMatchObject({
			status: "retrying",
			retryReason: "timeout",
		});
		expect(view.reasoning).toBe("compare two airports");
		expect(view.query).toMatchObject({ language: "cypher" });
		expect(view.result).toMatchObject({ result_type: "tabular" });
		expect(view.diagnosis).toMatchObject({ stage: "execute" });
		// Ordered by the emission's own seq, not by arrival.
		expect(view.emissions?.map((e) => e.kind)).toEqual([
			"metric",
			"table",
			"empty",
			"prose",
			"chart",
			"subgraph",
		]);
		expect(view.emissions?.[0]).toMatchObject({
			value: "—",
			citation: { recordCount: 0 },
		});
		expect(view.emissions?.[0]?.templates?.[0]).toMatchObject({
			version: 1,
			reason: null,
		});
	});

	it("ignores a frame for a run it was never told about", () => {
		useRunStore
			.getState()
			.apply("nope", { seq: 1, kind: "run.started", payload: {} });
		expect(useRunStore.getState().views).toEqual({});
	});
});
