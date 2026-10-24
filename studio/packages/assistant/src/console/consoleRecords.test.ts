import type {
	QueryResultItem,
	RunNode,
	Session,
	SessionMessage,
} from "@invana-studio/core";
import { describe, expect, it } from "vitest";
import {
	countsOf,
	labelGroupsOf,
	PAGE_SIZE,
	pageOf,
	queryStepsOf,
} from "./consoleRecords";

const node = (id: string, label: string, properties = {}): QueryResultItem => ({
	id,
	label,
	type: "vertex",
	properties,
});

const msg = (over: Partial<SessionMessage>): SessionMessage => ({
	id: "m",
	role: "assistant",
	content: "",
	createdAt: new Date(0),
	status: "ok",
	...over,
});

const step = (over: Partial<RunNode>): RunNode => ({
	id: "s",
	runId: "r1",
	seq: 1,
	taskKey: "graph.read.query",
	label: "Execute",
	attempt: 1,
	status: "succeeded",
	detail: "",
	...over,
});

const session = (messages: SessionMessage[]): Session => ({
	id: "sess",
	title: "",
	messages,
	createdAt: new Date(0),
	updatedAt: new Date(0),
	pinned: false,
	archived: false,
	nodeCount: 0,
	edgeCount: 0,
});

describe("the console's data", () => {
	it("is one group per label, nodes before relationships, columns the union of each label's own", () => {
		const items: QueryResultItem[] = [
			{
				id: "e1",
				label: "route",
				type: "edge",
				properties: { dist: 1 },
				source: "a",
				target: "b",
			},
			node("a", "airport", { code: "LHR" }),
			node("b", "airport", { city: "New York" }),
			node("c", "country", { name: "GB" }),
		];
		const groups = labelGroupsOf(items);
		expect(groups.map((g) => `${g.kind}:${g.label}`)).toEqual([
			"node:airport",
			"node:country",
			"relationship:route",
		]);
		expect(groups[0].columns).toEqual(["code", "city"]);
		expect(countsOf(items)).toEqual({ nodes: 3, relationships: 1 });
	});

	it("pages by twenty and clamps a page past the end to the last one", () => {
		const rows = Array.from({ length: 24 }, (_, i) => i);
		expect(pageOf(rows, 1)).toMatchObject({
			first: 1,
			last: PAGE_SIZE,
			pages: 2,
		});
		expect(pageOf(rows, 9)).toMatchObject({ page: 2, first: 21, last: 24 });
		expect(pageOf([], 1)).toMatchObject({ first: 0, last: 0, pages: 1 });
	});
});

describe("the session's queries", () => {
	it("lists each query newest first, with the question that ran it", () => {
		const steps = queryStepsOf(
			session([
				msg({ id: "u1", role: "user", content: "Which routes grow?" }),
				msg({
					id: "a1",
					runId: "r1",
					sourceQuery: "MATCH (a) RETURN a",
					steps: [step({ id: "s1" })],
				}),
				msg({ id: "u2", role: "user", content: "MATCH (b) RETURN b" }),
				msg({
					id: "a2",
					mode: "ql",
					runId: "r2",
					steps: [step({ id: "s2", runId: "r2" })],
				}),
			]),
		);
		expect(steps.map((s) => s.messageId)).toEqual(["a2", "a1"]);
		expect(steps[0]).toMatchObject({
			query: "MATCH (b) RETURN b",
			askedBy: undefined,
			stepId: "s2",
		});
		expect(steps[1]).toMatchObject({
			askedBy: "Which routes grow?",
			stepId: "s1",
		});
	});

	it("opens a failed query on the step that failed, and skips what ran nothing", () => {
		const steps = queryStepsOf(
			session([
				msg({ id: "u1", role: "user", content: "MATC (a)" }),
				msg({
					id: "a1",
					mode: "ql",
					status: "error",
					steps: [
						step({
							id: "v1",
							taskKey: "graph.read.validate",
							status: "failed",
						}),
					],
				}),
				msg({ id: "a2", operation: "expand", sourceQuery: "MATCH (n)--(m)" }),
				msg({ id: "a3", refusal: { detail: "denied" } as never }),
			]),
		);
		expect(steps).toHaveLength(1);
		expect(steps[0]).toMatchObject({
			status: "failed",
			stepId: "v1",
			query: "MATC (a)",
		});
	});
});
