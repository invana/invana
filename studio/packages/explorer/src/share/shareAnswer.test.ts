import { type Emission, formatShortDateTime } from "@invana-studio/core";
import { describe, expect, it } from "vitest";
import type { ShareAnswerArgs } from "../types";
import {
	answerCsv,
	answerMarkdown,
	fileSlug,
	liveLink,
	snapshotLink,
	snapshotSpec,
} from "./shareAnswer";

const args: ShareAnswerArgs = {
	username: "admin",
	graphSlug: "airways",
	sessionId: "s1",
	messageId: "m1",
	runId: "r1",
	question: "Busiest airports, by routes?",
	answer: "LHR leads with 12 routes.",
};

const cite = {
	recordCount: 2,
	query: "MATCH (n) RETURN n",
	queryLanguage: "cypher",
};

const table: Emission = {
	kind: "table",
	seq: 0,
	citation: cite,
	rows: [
		{ code: "LHR", note: 'says "hi", twice' },
		{ code: "CDG", routes: 9 },
	],
};

const subgraph: Emission = {
	kind: "subgraph",
	seq: 1,
	onCanvas: true,
	citation: cite,
	data: {
		nodes: [
			{ id: "1", label: "airport", properties: { code: "LHR" } },
			{ id: "2", label: "airport", properties: {} },
		],
		edges: [
			{ id: "e", label: "route", source: "1", target: "2", properties: {} },
		],
		records: [],
	},
};

const others: Emission[] = [
	{ kind: "metric", seq: 2, citation: cite, value: "12", label: "Routes" },
	{
		kind: "chart",
		seq: 3,
		citation: { recordCount: 2 },
		series: [{ label: "LHR", value: 12 }],
	},
	{ kind: "prose", seq: 4, citation: cite, text: "Mostly hubs." },
	{
		kind: "empty",
		seq: 5,
		citation: { recordCount: 0 },
		statement: "No delays.",
	},
];

const datasets = [
	{ address: "ourairports/airports@v3", typeName: "Airport", modelName: null },
];
const takenAt = new Date("2026-10-13T09:30:00Z");

describe("share an answer", () => {
	it("builds the live and snapshot links and a filename", () => {
		expect(liveLink("https://x", args)).toBe(
			"https://x/u/admin/airways/explorer/s1",
		);
		expect(snapshotLink("https://x", args, "v9")).toBe(
			"https://x/u/admin/airways/explorer?page=run%3Ar1%40v9",
		);
		expect(fileSlug(args.question)).toBe("busiest-airports-by-routes");
		expect(fileSlug("???")).toBe("answer");
	});

	it("freezes the answer as a board drawn from its records", () => {
		const spec = snapshotSpec({
			args,
			emissions: [table, subgraph, ...others],
			datasets,
			takenAt,
		});
		expect(spec.header?.chips?.map((c) => c.label)).toEqual([
			"Snapshot",
			"Everything",
			formatShortDateTime(takenAt),
		]);
		const kinds = spec.rows.map((r) => r.panels[0].kind);
		expect(kinds).toEqual([
			"narrative",
			"table",
			"table",
			"metric",
			"bars",
			"narrative",
			"text",
			"citations",
			"list",
		]);
		const empty = snapshotSpec({ args, emissions: [], datasets: [], takenAt });
		expect(empty.rows.map((r) => r.panels[0].kind)).toEqual([
			"narrative",
			"text",
			"citations",
			"text",
		]);
	});

	it("exports the table rows as quoted CSV, else the nodes", () => {
		expect(answerCsv([table, subgraph])).toBe(
			'code,note,routes\r\nLHR,"says ""hi"", twice",\r\nCDG,,9\r\n',
		);
		expect(answerCsv([subgraph])?.split("\r\n")[0]).toBe("id,label,code");
	});

	it("exports a chart's series and a metric when there is no table", () => {
		expect(answerCsv(others)).toBe("label,value\r\nRoutes,12\r\nLHR,12\r\n");
	});

	it("has no CSV when the answer has no rows", () => {
		expect(answerCsv(others.slice(2))).toBeNull();
	});

	it("writes the answer as Markdown, capping long tables", () => {
		const long: Emission = {
			...table,
			rows: Array.from({ length: 205 }, (_, i) => ({ n: i })),
		};
		const md = answerMarkdown({
			args: { ...args, worldName: "Europe" },
			emissions: [long, subgraph, ...others],
			datasets,
			takenAt,
		});
		expect(md.startsWith("# Busiest airports, by routes?\n\nLHR leads")).toBe(
			true,
		);
		expect(md).toContain("_…and 5 more rows_");
		expect(md).toContain("```cypher");
		expect(md).toContain("## World\n\nEurope");
		expect(md).toContain("- `ourairports/airports@v3` — Airport");
		expect(md).toContain("`r1` · shared 2026-10-13 09:30 UTC");
		expect(
			answerMarkdown({ args, emissions: [], datasets: [], takenAt }),
		).toContain("_No dataset versions were bound when this was shared._");
	});
});
