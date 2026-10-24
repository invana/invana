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

/** How far back the timeline and its tiles read, in days. */
export const WINDOW_DAYS = 30;

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
				title: run.body?.trim() || run.flow_key,
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
