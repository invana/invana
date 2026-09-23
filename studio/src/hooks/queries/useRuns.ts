/**
 * The runs journal — **everything that executed**, not everything imported.
 *
 * [SR23](docs/for-developers/modules/operate/features/see-what-ran.md): *an
 * import, a chat ask, a stitch commit, a provider ping and a canvas expansion
 * are all TaskRuns … the journal is filtered, not selective.*
 *
 * There is one endpoint now. This used to merge two — the import journal and
 * the run journal — and de-duplicate between them, because a load was both an
 * ImportJob row and a TaskRun and listing both showed every load twice. The
 * Dataset collapse left one record, so the merge went with it
 * ([§ 6.7](docs/for-developers/building-engine/task-model-migration.md)): a load
 * is a run, and *what kind* is a column.
 */

import { runsApi } from "@/services/api/runs";
import type { TaskRunSummary } from "@/types/work";
import { useQuery } from "@tanstack/react-query";

/** What a journal row is, whatever kind of work produced it. */
export type RunKind = "import" | "bulk" | "ask";

export interface JournalRow {
	id: string;
	kind: RunKind;
	/**
	 * What the run was about, in the words it was opened with — the question as
	 * typed, the query text, or the records it loaded (SR45).
	 */
	title: string;
	/** The title is a query, not a sentence — a `ql-*` plan ran it. */
	isQuery: boolean;
	/** The plan that ran — `nl-query@5`, the head of line two. */
	plan: string;
	status: string;
	startedAt: string | null;
	/** The run behind this row. Every row has one; that is the point. */
	run: TaskRunSummary;
}

const LIVE = ["queued", "running"];

/** A plan reads better than an id: `nl-single@1` beats `template:nl-single@1`. */
function planOf(t: TaskRunSummary): string {
	const source = t.plan_origin ?? "";
	if (source.startsWith("template:")) return source.slice("template:".length);
	if (source === "generated") return `${t.workflow_key} · planned`;
	return t.workflow_key;
}

/**
 * A row's title: what the run was about, in the words its opener wrote.
 *
 * A load says `Import news-tv`, an ask says what it was asked and a `ql-*` run
 * says its query, so none needs a second request to read — which is why `body`
 * is on the list row. A run with no body falls back to its Task, then its plan.
 */
function titleOf(t: TaskRunSummary): string {
	if (t.kind === "import" || t.kind === "bulk") {
		return t.body ?? "records removed";
	}
	return t.body?.trim() || t.task_title || planOf(t);
}

/** How far back the journal reads — the `since` chip. */
export type RunsSince = "today" | "7d" | "30d";

/** What the journal's filter chips are set to; `null` is "not filtered". */
export interface RunsFilters {
	kind?: string | null;
	status?: string | null;
	role?: string | null;
	agentId?: string | null;
	since?: RunsSince | null;
}

function sinceCutoff(since: RunsSince): number {
	const now = new Date();
	if (since === "today") {
		now.setHours(0, 0, 0, 0);
		return now.getTime();
	}
	return now.getTime() - (since === "7d" ? 7 : 30) * 86_400_000;
}

/**
 * The journal, newest first.
 *
 * The chips narrow here rather than server-side: the endpoint takes `kind` and
 * `agent_id` but not status, role or a date, and one page of fifty is what the
 * drawer reads either way. `total` is the unfiltered count, so the status bar
 * can say `11 of 24 shown`.
 */
export function useRunsJournalQuery(
	username?: string,
	graphSlug?: string,
	{ kind, status, role, agentId, since }: RunsFilters = {},
) {
	const runs = useQuery({
		queryKey: ["runs", username, graphSlug, "journal"] as const,
		queryFn: () =>
			runsApi.list(username as string, graphSlug as string, { limit: 50 }),
		enabled: !!username && !!graphSlug,
	});

	const items = runs.data?.items ?? [];
	const cutoff = since ? sinceCutoff(since) : null;
	const rows: JournalRow[] = items
		.filter((t) => !status || t.status === status)
		.filter((t) => !kind || t.kind === kind)
		.filter((t) => !role || t.role === role)
		.filter((t) => !agentId || t.agent_id === agentId)
		.filter(
			(t) =>
				cutoff === null ||
				(t.queued_at !== null && Date.parse(t.queued_at) >= cutoff),
		)
		.map((t) => ({
			id: t.id,
			// A run with no kind predates the column; it is an ask, which is
			// what every run was before a load became one.
			kind: (t.kind ?? "ask") as RunKind,
			title: titleOf(t),
			isQuery: t.workflow_key.startsWith("ql-") && !!t.body?.trim(),
			plan: planOf(t),
			status: t.status,
			startedAt: t.queued_at,
			run: t,
		}))
		.sort((a, b) => (b.startedAt ?? "").localeCompare(a.startedAt ?? ""));

	return {
		rows,
		total: items.length,
		isLoading: runs.isLoading,
		// The panel header's refresh control spins on `isFetching` and calls
		// `refetch` — a list a person is watching needs a way to ask again.
		isFetching: runs.isFetching,
		refetch: runs.refetch,
		live: items.filter((t) => LIVE.includes(t.status)).length,
	};
}
