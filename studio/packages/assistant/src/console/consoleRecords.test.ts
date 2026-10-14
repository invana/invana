import type { Emission, RunNode, SessionMessage } from "@invana-studio/core";
import { describe, expect, it } from "vitest";
import { logOf, queriesOf, recordsOf } from "./consoleRecords";

const citation = {
	recordCount: 2,
	query: "MATCH (a)-[r]->(b) RETURN a, r, b",
	queryLanguage: "cypher",
};

const reply = (over: Partial<SessionMessage> = {}): SessionMessage => ({
	id: "m1",
	role: "assistant",
	content: "Returned 2 nodes.",
	createdAt: new Date(0),
	status: "ok",
	...over,
});

const step = (over: Partial<RunNode>): RunNode => ({
	id: "s1",
	runId: "r1",
	seq: 1,
	taskKey: "graph.query",
	label: "Query",
	attempt: 1,
	status: "succeeded",
	detail: "",
	...over,
});

describe("the console's records", () => {
	it("reads a subgraph as one row per element, each selectable by id", () => {
		const emissions: Emission[] = [
			{
				seq: 0,
				kind: "subgraph",
				onCanvas: true,
				citation,
				data: {
					nodes: [
						{ id: "lhr", label: "airport", properties: {} },
						{ id: "jfk", label: "airport", properties: {} },
					],
					edges: [
						{
							id: "e1",
							label: "route",
							source: "lhr",
							target: "jfk",
							properties: { dist: 5540 },
						},
					],
					records: [],
				},
			},
		];
		const records = recordsOf(emissions);
		expect(records?.elementIds).toEqual(["lhr", "jfk", "e1"]);
		expect(records?.rows[2]).toMatchObject({ element: "relationship" });
		expect(queriesOf(emissions, null)).toEqual([
			{ query: citation.query, language: "cypher", executionTimeMs: undefined },
		]);
	});

	it("says nothing ran when there is no emission, and 0 records for an empty one", () => {
		expect(recordsOf([])).toBeNull();
		expect(
			recordsOf([
				{
					seq: 0,
					kind: "empty",
					statement: "none",
					citation: { recordCount: 0 },
				},
			]),
		).toEqual({ columns: [], rows: [] });
	});
});

describe("the console's log", () => {
	it("follows a failed step with its error", () => {
		const lines = logOf(reply({ status: "error" }), [
			step({ id: "s0", seq: 0, taskKey: "parse", label: "Parse" }),
			step({
				status: "failed",
				error: { message: "syntax error · line 1, col 1" },
			}),
		]);
		expect(lines.map((l) => l.level)).toEqual(["info", "error", "error"]);
		expect(lines.at(-1)?.message).toBe("syntax error · line 1, col 1");
	});

	it("falls back to the reply's own failure when no step says why", () => {
		const lines = logOf(
			reply({ status: "error", content: "Query failed." }),
			[],
		);
		expect(lines).toHaveLength(1);
		expect(lines[0]).toMatchObject({
			level: "error",
			message: "Query failed.",
		});
	});
});
