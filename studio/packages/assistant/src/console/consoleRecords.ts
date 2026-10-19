/**
 * What the console reads — the canvas's data, grouped for one table per label,
 * and the session's query steps — as plain data, so the panel only lays it out.
 *
 * Data is everything drawn on the canvas. Labels carry different properties,
 * so the records are grouped by node label and by relationship type, and each
 * group's columns are the union of its own records' properties. A page is
 * `PAGE_SIZE` records; the count is always the full one.
 *
 * Queries are the session's query steps, newest first: one per reply that ran
 * a query — the `execute_graph_query` step of its run, or the step that failed
 * before it got there. Sessions live in the chat and runs in Activity; this is
 * only the queries.
 */

import type {
	QueryResultItem,
	RunNode,
	Session,
	SessionMessage,
} from "@invana-studio/core";

/** The console's two tabs; the value is also what `?console=` holds. */
export type ConsoleTab = "data" | "queries";

export const CONSOLE_TABS: readonly ConsoleTab[] = ["data", "queries"];

/** Records a page of Data holds. */
export const PAGE_SIZE = 20;

export type LabelKind = "node" | "relationship";

export interface LabelGroup {
	kind: LabelKind;
	label: string;
	/** Union of the group's property keys, in first-seen order. */
	columns: string[];
	items: QueryResultItem[];
}

/** The canvas's records, nodes then relationships, one group per label. */
export function labelGroupsOf(items: readonly QueryResultItem[]): LabelGroup[] {
	const byKey = new Map<string, LabelGroup>();
	for (const item of items) {
		const kind: LabelKind = item.type === "edge" ? "relationship" : "node";
		const key = `${kind}:${item.label}`;
		let group = byKey.get(key);
		if (!group) {
			group = { kind, label: item.label, columns: [], items: [] };
			byKey.set(key, group);
		}
		group.items.push(item);
		for (const k of Object.keys(item.properties ?? {}))
			if (!group.columns.includes(k)) group.columns.push(k);
	}
	const groups = [...byKey.values()];
	return [
		...groups.filter((g) => g.kind === "node"),
		...groups.filter((g) => g.kind === "relationship"),
	];
}

/** How many nodes and relationships the canvas holds. */
export function countsOf(items: readonly QueryResultItem[]) {
	let relationships = 0;
	for (const i of items) if (i.type === "edge") relationships += 1;
	return { nodes: items.length - relationships, relationships };
}

/** The page of a group, clamped to the pages it has. */
export function pageOf<T>(rows: readonly T[], page: number) {
	const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
	const at = Math.min(Math.max(1, page), pages);
	const first = (at - 1) * PAGE_SIZE;
	return {
		page: at,
		pages,
		first: rows.length ? first + 1 : 0,
		last: Math.min(first + PAGE_SIZE, rows.length),
		rows: rows.slice(first, first + PAGE_SIZE),
	};
}

export type QueryStatus = "done" | "failed" | "running";

export interface QueryStep {
	/** The reply the query ran under — the row's identity and `?query=`. */
	messageId: string;
	runId?: string;
	/** The step to open: the query's own, or the one that failed before it. */
	stepId?: string;
	status: QueryStatus;
	query: string;
	language?: string;
	at: Date;
	executionTimeMs?: number;
	rowCount?: number;
	/** The question that ran it; absent when the query was typed. */
	askedBy?: string;
}

const QUERY_TASK = "execute_graph_query";

/** The step a query row opens: its latest query attempt, else the failed one. */
function stepOf(steps: readonly RunNode[] | undefined): RunNode | undefined {
	if (!steps?.length) return undefined;
	const latest = (key: (s: RunNode) => boolean) =>
		[...steps].filter(key).sort((a, b) => b.seq - a.seq)[0];
	return (
		latest((s) => s.taskKey === QUERY_TASK) ??
		latest((s) => s.status === "failed")
	);
}

function statusOf(m: SessionMessage): QueryStatus {
	if (m.status === "error") return "failed";
	if (m.status === "running") return "running";
	return "done";
}

/** Every query this session ran, newest first. */
export function queryStepsOf(session: Session | null): QueryStep[] {
	if (!session) return [];
	const out: QueryStep[] = [];
	let prompt: SessionMessage | undefined;
	for (const m of session.messages) {
		if (m.role === "user") {
			prompt = m;
			continue;
		}
		// A refusal ran nothing; a canvas operation is the board's own act.
		if (m.refusal || m.operation) continue;
		const typed = m.mode === "ql";
		const query = m.sourceQuery ?? (typed ? prompt?.content : undefined);
		const step = stepOf(m.steps);
		if (!query && !step) continue;
		out.push({
			messageId: m.id,
			runId: m.runId,
			stepId: step?.id,
			status: statusOf(m),
			query: query ?? step?.detail ?? "",
			language: m.language,
			at: step?.startedAt ?? m.createdAt,
			executionTimeMs: m.executionTimeMs,
			rowCount: m.rowCount,
			askedBy: typed ? undefined : prompt?.content,
		});
	}
	return out.reverse();
}

export interface ConsoleLogLine {
	id: string;
	/** When, already worded — `10:42:07`; empty when the step never started. */
	at: string;
	level: "info" | "error";
	/** The step that wrote it — `execute_graph_query`. */
	source: string;
	message: string;
}

function clock(at: Date | undefined): string {
	return at ? at.toLocaleTimeString([], { hour12: false }) : "";
}

/**
 * A reply's run as log lines, oldest first, each failed step followed by its
 * error; then the reply's own failure when no step said why. What a query's
 * detail shows when its run left no trace to open.
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
