/**
 * What the console reads out of a reply — its records, the queries it ran and
 * the log of its run — as plain data, so the panel only lays it out.
 *
 * Records come from the reply's emissions: a table's rows as they are, a
 * subgraph's nodes and relationships one row each (so a row can select its
 * element on the canvas). The queries are the emissions' citations, falling
 * back to the reply's own source query. The log is the run's steps in order,
 * then the failure the reply recorded when no step carried one.
 */

import type { Emission, RunNode, SessionMessage } from "@invana-studio/core";

/** The console's three tabs; the value is also what `?console=` holds. */
export type ConsoleTab = "records" | "query" | "log";

export const CONSOLE_TABS: readonly ConsoleTab[] = ["records", "query", "log"];

export interface ConsoleRecords {
	columns: string[];
	rows: Record<string, unknown>[];
	/** One canvas element id per row, when the rows are drawn elements. */
	elementIds?: string[];
}

/** The records behind the reply, or `null` when nothing produced any. */
export function recordsOf(
	emissions: readonly Emission[],
): ConsoleRecords | null {
	for (const e of emissions) {
		if (e.kind === "table") {
			return {
				columns: e.rows.length > 0 ? Object.keys(e.rows[0]) : [],
				rows: e.rows,
			};
		}
		if (e.kind === "subgraph") {
			const rows = [
				...e.data.nodes.map((n) => ({
					id: n.id,
					element: "node",
					label: n.label,
					properties: n.properties,
				})),
				...e.data.edges.map((r) => ({
					id: r.id,
					element: "relationship",
					label: r.label,
					properties: r.properties,
				})),
			];
			return {
				columns: ["id", "element", "label", "properties"],
				rows,
				elementIds: rows.map((r) => r.id),
			};
		}
	}
	// An empty emission is an answer with no rows — not "nothing ran".
	return emissions.some((e) => e.kind === "empty")
		? { columns: [], rows: [] }
		: null;
}

export interface ConsoleQuery {
	query: string;
	language?: string;
	executionTimeMs?: number;
}

/** The queries the reply ran, verbatim and in order, without repeats. */
export function queriesOf(
	emissions: readonly Emission[],
	message: SessionMessage | null,
): ConsoleQuery[] {
	const seen = new Set<string>();
	const out: ConsoleQuery[] = [];
	for (const e of emissions) {
		const q = e.citation.query;
		if (!q || seen.has(q)) continue;
		seen.add(q);
		out.push({
			query: q,
			language: e.citation.queryLanguage,
			executionTimeMs: e.citation.executionTimeMs,
		});
	}
	if (out.length === 0 && message?.sourceQuery) {
		out.push({
			query: message.sourceQuery,
			language: message.language,
			executionTimeMs: message.executionTimeMs,
		});
	}
	return out;
}

export interface ConsoleLogLine {
	id: string;
	/** When, already worded — `10:42:07`; empty when the step never started. */
	at: string;
	level: "info" | "error";
	/** The step that wrote it — `graph.query`. */
	source: string;
	message: string;
}

function clock(at: Date | undefined): string {
	return at ? at.toLocaleTimeString([], { hour12: false }) : "";
}

/**
 * The run's steps as log lines, oldest first, each failed one followed by its
 * error; then the reply's own failure when no step said why.
 */
export function logOf(
	message: SessionMessage | null,
	steps: readonly RunNode[],
): ConsoleLogLine[] {
	if (!message) return [];
	const lines: ConsoleLogLine[] = [];
	for (const s of [...steps].sort((a, b) => a.seq - b.seq)) {
		const failed = s.status === "failed";
		lines.push({
			id: s.id,
			at: clock(s.startedAt),
			level: failed ? "error" : "info",
			source: s.taskKey,
			message: [s.label, s.status, s.detail].filter(Boolean).join(" · "),
		});
		const error = s.error?.message ?? s.error?.cause;
		if (failed && error) {
			lines.push({
				id: `${s.id}:error`,
				at: clock(s.finishedAt ?? s.startedAt),
				level: "error",
				source: s.taskKey,
				message: error,
			});
		}
	}
	const stepSaidWhy = lines.some((l) => l.level === "error");
	if (message.status === "error" && !stepSaidWhy) {
		lines.push({
			id: `${message.id}:error`,
			at: clock(message.createdAt),
			level: "error",
			source: message.language ?? "query",
			message: message.content,
		});
	}
	return lines;
}
