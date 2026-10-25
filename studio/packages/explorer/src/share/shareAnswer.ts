/**
 * Sharing an answer, as pure functions: the links, the frozen snapshot's
 * document, and the two text exports.
 *
 * Nothing here fetches and nothing here renders. The share dialog reads the
 * answer's emissions and the Graph's dataset bindings once, and hands them to
 * these functions — so what a snapshot keeps and what an export carries is
 * decided in one place, and is exactly what the member was looking at.
 *
 * | Function | Gives |
 * |---|---|
 * | `liveLink` | The thread's own path — the same board and chat, as they are when opened |
 * | `snapshotLink` | The Explorer with the frozen-report page open, and no thread in the path |
 * | `snapshotSpec` | The `BoardSpec` kept as the snapshot: header, answer, one panel per emission, citations, dataset versions |
 * | `answerCsv` | The answer's rows — every table's rows, else the subgraph's nodes; `null` when there are none |
 * | `answerMarkdown` | The question, answer, records, citations, world, dataset versions and run, in one file |
 * | `fileSlug` | A filename stem from the question |
 *
 * An export never reads the graph again: the rows are the run's, read inside
 * its frozen lens, so the guardrails already bounded them.
 */

import type { BoardSpec, PanelSpec } from "@invana/boards";
import { type Emission, formatShortDateTime } from "@invana-studio/core";
import type { BoundDataset, ShareAnswerArgs } from "../types";

/** Rows a Markdown table holds before the rest are counted instead. */
const MARKDOWN_ROW_CAP = 200;

type LinkArgs = Pick<ShareAnswerArgs, "username" | "graphSlug" | "sessionId">;

/** The thread's own path. Sharing it writes nothing. */
export function liveLink(origin: string, args: LinkArgs): string {
	return `${origin}/u/${args.username}/${args.graphSlug}/explorer/${args.sessionId}`;
}

/**
 * The Explorer with the snapshot — a report on the run — open. The path names
 * no thread: a thread in the path opens its own board and takes the focus.
 */
export function snapshotLink(
	origin: string,
	args: LinkArgs & Pick<ShareAnswerArgs, "runId">,
	versionId: string,
): string {
	const page = encodeURIComponent(`run:${args.runId}@${versionId}`);
	return `${origin}/u/${args.username}/${args.graphSlug}/explorer?page=${page}`;
}

/** A filename stem from the question — `busiest-airports-in-europe`. */
export function fileSlug(question: string): string {
	const slug = question
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 60)
		.replace(/-+$/g, "");
	return slug || "answer";
}

/** When an export was taken: UTC, since the file travels outside the Graph. */
function takenAtLabel(at: Date): string {
	return `${at.toISOString().slice(0, 16).replace("T", " ")} UTC`;
}

// ── values ───────────────────────────────────────────────────────────────────

/** One value as text: empty for nothing, JSON for a structure. */
function text(value: unknown): string {
	if (value === null || value === undefined) return "";
	if (typeof value === "string") return value;
	if (typeof value === "number" || typeof value === "boolean")
		return String(value);
	return JSON.stringify(value);
}

/** One value as a table cell: numbers stay figures, everything else is text. */
function cell(value: unknown): string | number | null {
	if (value === null || value === undefined) return null;
	if (typeof value === "number") return value;
	return text(value);
}

/** Every key the rows carry, in the order first seen. */
function columnsOf(rows: Record<string, unknown>[]): string[] {
	const keys = new Set<string>();
	for (const row of rows) for (const k of Object.keys(row)) keys.add(k);
	return [...keys];
}

type Node = Extract<Emission, { kind: "subgraph" }>["data"]["nodes"][number];

/** What a node is called on a drawing: its name if it has one, else its type. */
function nodeName(node: Node): string {
	const p = node.properties ?? {};
	for (const key of ["name", "title", "code"]) {
		if (p[key] !== undefined && p[key] !== null) return text(p[key]);
	}
	return `${node.label} ${node.id}`;
}

/** The subgraph's nodes as rows — `id`, `label`, then their properties. */
function nodeRows(emissions: Emission[]): Record<string, unknown>[] {
	const rows: Record<string, unknown>[] = [];
	for (const e of emissions) {
		if (e.kind !== "subgraph") continue;
		for (const n of e.data.nodes) {
			rows.push({ id: n.id, label: n.label, ...(n.properties ?? {}) });
		}
	}
	return rows;
}

/** A chart's series and a metric's figure as rows — `label`, `value`. */
function figureRows(emissions: Emission[]): Record<string, unknown>[] {
	return emissions.flatMap((e): Record<string, unknown>[] => {
		if (e.kind === "chart")
			return e.series.map((s) => ({ label: s.label, value: s.value }));
		if (e.kind === "metric")
			return [{ label: e.label ?? "value", value: e.value }];
		return [];
	});
}

/**
 * The answer's rows: every table's rows, else the subgraph's nodes, else the
 * chart's series and the metric — the same records the Markdown export writes.
 */
function answerRows(emissions: Emission[]): Record<string, unknown>[] {
	const tables = emissions.flatMap((e) => (e.kind === "table" ? e.rows : []));
	if (tables.length) return tables;
	const nodes = nodeRows(emissions);
	return nodes.length ? nodes : figureRows(emissions);
}

// ── the snapshot ─────────────────────────────────────────────────────────────

export interface SnapshotInput {
	args: ShareAnswerArgs;
	emissions: Emission[];
	datasets: BoundDataset[];
	takenAt: Date;
}

/** A link, as the line a reader of the share sees — the list it opened. */
function linkLine(e: Extract<Emission, { kind: "link" }>): string {
	return `Opened ${e.label} — ${e.total} ${e.total === 1 ? e.noun[0] : e.noun[1]}`;
}

/** One emission as the panel that draws it. */
function emissionPanel(e: Emission): PanelSpec {
	const count = e.citation.recordCount;
	switch (e.kind) {
		case "table": {
			const cols = columnsOf(e.rows);
			return {
				kind: "table",
				title: "Records",
				aside: `${count} ${count === 1 ? "record" : "records"}`,
				flush: true,
				options: {
					columns: cols.map((key) => ({ key, label: key })),
					rows: e.rows.map((r) =>
						Object.fromEntries(cols.map((k) => [k, cell(r[k])])),
					),
				},
			};
		}
		case "metric":
			return {
				kind: "metric",
				options: {
					label: e.label ?? "Value",
					value: e.value,
					delta: e.comparison,
				},
			};
		case "chart":
			return {
				kind: "bars",
				title: e.caption ?? "Chart",
				options: {
					groups: e.series.map((s) => s.label),
					series: [
						{
							name: e.caption ?? "Value",
							values: e.series.map((s) => s.value),
						},
					],
				},
			};
		// The kit draws no subgraph block yet, so the board's nodes are read as
		// rows — named, typed, with the edge count beside them.
		case "subgraph":
			return {
				kind: "table",
				title: "Board",
				aside: `${e.data.nodes.length} nodes · ${e.data.edges.length} edges`,
				flush: true,
				options: {
					columns: [
						{ key: "name", label: "name" },
						{ key: "type", label: "type" },
						{ key: "id", label: "id" },
					],
					rows: e.data.nodes.map((n) => ({
						name: nodeName(n),
						type: n.label,
						id: String(n.id),
					})),
				},
			};
		case "prose":
			return { kind: "narrative", options: { text: e.text } };
		case "empty":
			return { kind: "text", options: { text: e.statement, tone: "muted" } };
		case "link":
			return { kind: "text", options: { text: linkLine(e) } };
	}
}

/**
 * The frozen snapshot: the answer as it stands now, stored whole and never
 * re-read against the run.
 *
 * The board is kept as its records — its nodes as rows, not a picture — so it
 * reads at any size and in either theme. The dataset versions are the
 * Graph's bindings when the snapshot is taken, said as such.
 */
export function snapshotSpec({
	args,
	emissions,
	datasets,
	takenAt,
}: SnapshotInput): BoardSpec {
	const records: PanelSpec[] = emissions.length
		? emissions.map(emissionPanel)
		: [{ kind: "text", options: { text: "No records", tone: "muted" } }];
	const sources = emissions.map((e) => ({
		label: e.citation.query ?? e.kind,
		count: e.citation.recordCount,
		detail: [e.citation.queryLanguage, e.kind].filter(Boolean).join(" · "),
	}));
	const datasetPanel: PanelSpec = datasets.length
		? {
				kind: "list",
				title: "Dataset versions",
				aside: "bound when this was taken",
				options: {
					items: datasets.map((d) => ({
						title: d.address,
						meta: d.typeName,
						mono: true,
					})),
				},
			}
		: {
				kind: "text",
				title: "Dataset versions",
				options: {
					text: "No dataset versions were bound when this was taken.",
					tone: "muted",
				},
			};
	return {
		title: args.question,
		header: {
			crumbs: [args.question],
			chips: [
				{ label: "Snapshot", tone: "info" },
				{ label: args.worldName ?? "Everything", variant: "outline" },
				{ label: formatShortDateTime(takenAt), variant: "outline" },
			],
		},
		rows: [
			{ panels: [{ kind: "narrative", options: { text: args.answer } }] },
			...records.map((p) => ({ panels: [p] })),
			{
				panels: [
					{
						kind: "citations",
						title: "Citations",
						options: {
							sources,
							note: sources.length ? undefined : "No records",
						},
					},
				],
			},
			{ panels: [datasetPanel] },
		],
	};
}

// ── CSV ──────────────────────────────────────────────────────────────────────

/** One CSV field: quoted when it holds a quote, a comma or a line break. */
function csvField(value: unknown): string {
	const s = text(value);
	return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * The answer's rows as CSV — every table emission's rows, else the subgraph's
 * nodes (`id`, `label`, then their properties). `null` when the answer has no
 * rows, which is why the export is offered disabled.
 */
export function answerCsv(emissions: Emission[]): string | null {
	const rows = answerRows(emissions);
	if (!rows.length) return null;
	const cols = columnsOf(rows);
	const lines = [
		cols.map(csvField).join(","),
		...rows.map((r) => cols.map((k) => csvField(r[k])).join(",")),
	];
	return `${lines.join("\r\n")}\r\n`;
}

// ── Markdown ─────────────────────────────────────────────────────────────────

/** One Markdown table cell: pipes escaped, line breaks flattened. */
function mdCell(value: unknown): string {
	return text(value).replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
}

/** Rows as a Markdown table, capped, with the rest counted under it. */
function mdTable(rows: Record<string, unknown>[], cols = columnsOf(rows)) {
	if (!rows.length || !cols.length) return "_No rows_";
	const shown = rows.slice(0, MARKDOWN_ROW_CAP);
	const lines = [
		`| ${cols.map(mdCell).join(" | ")} |`,
		`| ${cols.map(() => "---").join(" | ")} |`,
		...shown.map((r) => `| ${cols.map((k) => mdCell(r[k])).join(" | ")} |`),
	];
	const rest = rows.length - shown.length;
	if (rest > 0) lines.push("", `_…and ${rest} more rows_`);
	return lines.join("\n");
}

/** One emission, as a section of the file. */
function mdEmission(e: Emission): string {
	switch (e.kind) {
		case "table":
			return `### Records\n\n${mdTable(e.rows)}`;
		case "metric":
			return `### ${e.label ?? "Value"}\n\n**${e.value}**${e.comparison ? ` — ${e.comparison}` : ""}`;
		case "chart":
			return `### ${e.caption ?? "Chart"}\n\n${mdTable(
				e.series.map((s) => ({ label: s.label, value: s.display ?? s.value })),
			)}`;
		case "subgraph":
			return `### Subgraph · ${e.data.nodes.length} nodes · ${e.data.edges.length} edges\n\n${mdTable(
				e.data.nodes.map((n) => ({
					id: n.id,
					label: n.label,
					name: nodeName(n),
				})),
			)}`;
		case "prose":
			return e.text;
		case "empty":
			return `_${e.statement}_`;
		case "link":
			return linkLine(e);
	}
}

/**
 * The answer as one Markdown file: the question as the heading, the answer,
 * each emission (tables capped at 200 rows, the rest counted), the queries
 * as citations, the world, the dataset versions, the run and when it was shared.
 */
export function answerMarkdown({
	args,
	emissions,
	datasets,
	takenAt,
}: SnapshotInput): string {
	const parts = [`# ${args.question}`, args.answer];
	parts.push(
		emissions.length ? emissions.map(mdEmission).join("\n\n") : "_No records_",
	);
	parts.push("## Citations");
	parts.push(
		emissions.length
			? emissions
					.map((e, i) => {
						const c = e.citation;
						const head = `${i + 1}. ${c.queryLanguage ?? e.kind} · ${c.recordCount} ${c.recordCount === 1 ? "record" : "records"}`;
						return c.query
							? `${head}\n\n   \`\`\`${c.queryLanguage ?? ""}\n   ${c.query.replace(/\n/g, "\n   ")}\n   \`\`\``
							: head;
					})
					.join("\n")
			: "_No records_",
	);
	parts.push("## World", args.worldName ?? "Everything");
	parts.push(
		"## Dataset versions",
		datasets.length
			? `Bound when this was shared:\n\n${datasets
					.map((d) => `- \`${d.address}\` — ${d.typeName}`)
					.join("\n")}`
			: "_No dataset versions were bound when this was shared._",
	);
	parts.push("## Run", `\`${args.runId}\` · shared ${takenAtLabel(takenAt)}`);
	return `${parts.join("\n\n")}\n`;
}
