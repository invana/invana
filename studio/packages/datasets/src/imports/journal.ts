/**
 * The Imports journal's arithmetic — rows, the day buckets the timeline draws
 * and the tiles' figures — kept apart from the queries so it can be tested.
 *
 * An import is a run like any other: `invana records import` opens a run of
 * kind `import`, and `invana loader` one of kind `bulk`. Runs belong to a
 * Graph, while Datasets is install-wide, so the journal is the union of every
 * readable Graph's import runs, each row naming the Graph it landed in.
 *
 * Only what a run list row carries is counted. Records written and rejected
 * are not on the row, so no figure here claims them.
 */
import type { TaskRunSummary } from "@invana-studio/core";

/** The run kinds that are loads. */
export const IMPORT_KINDS = ["import", "bulk"] as const;

type ImportKind = (typeof IMPORT_KINDS)[number];

/** The Graph a run landed in. */
export interface ImportGraph {
	username: string;
	graphSlug: string;
	name: string;
}

export interface ImportRow {
	id: string;
	kind: ImportKind;
	/** What the opener wrote — `Import news-tv`. */
	title: string;
	status: string;
	queuedAt: string | null;
	graph: ImportGraph;
	run: TaskRunSummary;
}

const LIVE = new Set(["queued", "running"]);

/** How far back the timeline and its tiles read, in days. */
export const WINDOW_DAYS = 30;

const DAY_MS = 86_400_000;

function isImportKind(kind: string | null): kind is ImportKind {
	return kind === "import" || kind === "bulk";
}

/**
 * Every Graph's import runs as one journal, newest first. A run listed twice
 * (one page per kind can overlap) is kept once; a run of another kind is
 * dropped, whatever the endpoint returned.
 */
export function mergeImports(
	perGraph: { graph: ImportGraph; items: TaskRunSummary[] }[],
): ImportRow[] {
	const seen = new Map<string, ImportRow>();
	for (const { graph, items } of perGraph) {
		for (const run of items) {
			if (!isImportKind(run.kind)) continue;
			const key = `${graph.username}/${graph.graphSlug}/${run.id}`;
			if (seen.has(key)) continue;
			seen.set(key, {
				id: run.id,
				kind: run.kind,
				title: run.body?.trim() || run.workflow_key,
				status: run.status,
				queuedAt: run.queued_at,
				graph,
				run,
			});
		}
	}
	return [...seen.values()].sort((a, b) =>
		(b.queuedAt ?? "").localeCompare(a.queuedAt ?? ""),
	);
}

function startOfDay(ms: number): number {
	const d = new Date(ms);
	d.setHours(0, 0, 0, 0);
	return d.getTime();
}

/**
 * Imports a day over the window ending today, oldest first — one bucket per
 * day, empty days included, so the timeline's gaps are real gaps.
 */
export function importsByDay(
	rows: ImportRow[],
	now: number,
	days = WINDOW_DAYS,
): { day: number; count: number }[] {
	const today = startOfDay(now);
	const buckets = Array.from({ length: days }, (_, i) => ({
		day: today - (days - 1 - i) * DAY_MS,
		count: 0,
	}));
	const first = buckets[0]?.day ?? today;
	for (const row of rows) {
		if (!row.queuedAt) continue;
		const day = startOfDay(Date.parse(row.queuedAt));
		if (day < first || day > today) continue;
		// A daylight-saving day is 23 or 25 hours long, so round, not floor.
		const bucket = buckets[Math.round((day - first) / DAY_MS)];
		if (bucket) bucket.count += 1;
	}
	return buckets;
}

/** The tiles over the window: how many, how many live or failed, median time. */
export function importStats(
	rows: ImportRow[],
	now: number,
	days = WINDOW_DAYS,
): {
	total: number;
	live: number;
	failed: number;
	medianMs: number | null;
} {
	const cutoff = startOfDay(now) - (days - 1) * DAY_MS;
	const inWindow = rows.filter(
		(r) => r.queuedAt !== null && Date.parse(r.queuedAt) >= cutoff,
	);
	const durations = inWindow
		.map((r) => {
			const { started_at, finished_at } = r.run;
			return started_at && finished_at
				? Date.parse(finished_at) - Date.parse(started_at)
				: null;
		})
		.filter((ms): ms is number => ms !== null && ms >= 0)
		.sort((a, b) => a - b);
	const mid = Math.floor(durations.length / 2);
	const medianMs = !durations.length
		? null
		: durations.length % 2
			? (durations[mid] as number)
			: ((durations[mid - 1] as number) + (durations[mid] as number)) / 2;
	return {
		total: inWindow.length,
		live: rows.filter((r) => LIVE.has(r.status)).length,
		failed: inWindow.filter((r) => r.status === "failed").length,
		medianMs,
	};
}
