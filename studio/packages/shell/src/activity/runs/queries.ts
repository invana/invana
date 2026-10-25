import {
	type ListQuery,
	listQueryKey,
	runsApi,
	type TaskRunSummary,
} from "@invana-studio/core";
import { keepPreviousData, useQuery } from "@tanstack/react-query";

/** What a journal row is, whatever kind of work produced it. */
type RunKind = "import" | "bulk" | "ask";

export interface RunListRow {
	id: string;
	kind: RunKind;
	/**
	 * What the run was about, in the words it was opened with — the question as
	 * typed, the query text, or the records it loaded.
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

/** A plan reads better than an id: `nl-single@1` beats `template:nl-single@1`. */
function planOf(t: TaskRunSummary): string {
	const source = t.plan_origin ?? "";
	if (source.startsWith("template:")) return source.slice("template:".length);
	if (source === "generated") return `${t.flow_key} · planned`;
	return t.flow_key;
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

/**
 * The journal under `query`, newest first — what `useListParams` reads from
 * the URL. The engine searches, filters, sorts and counts: `total` is every
 * run that matches and `unfilteredTotal` the whole journal, so the page can
 * say `2 of 61 match`, and `applied` names each filter as its chip reads.
 */
export function useRunListQuery(
	username?: string,
	graphSlug?: string,
	query: ListQuery = {},
) {
	const asked: ListQuery = { ...query, limit: query.limit ?? 50 };
	const runs = useQuery({
		queryKey: [
			"runs",
			username,
			graphSlug,
			"journal",
			listQueryKey(asked),
		] as const,
		queryFn: () => runsApi.list(username as string, graphSlug as string, asked),
		enabled: !!username && !!graphSlug,
		placeholderData: keepPreviousData,
	});

	const rows: RunListRow[] = (runs.data?.items ?? []).map((t) => ({
		id: t.id,
		// A run with no kind predates the column; it is an ask, which is
		// what every run was before a load became one.
		kind: (t.kind ?? "ask") as RunKind,
		title: titleOf(t),
		isQuery: t.flow_key.startsWith("ql-") && !!t.body?.trim(),
		plan: planOf(t),
		status: t.status,
		startedAt: t.queued_at,
		run: t,
	}));

	return {
		rows,
		total: runs.data?.total ?? 0,
		unfilteredTotal: runs.data?.unfiltered_total ?? 0,
		applied: runs.data?.applied,
		isLoading: runs.isLoading,
		isError: runs.isError,
		error: runs.error,
		// The panel header's refresh control spins on `isFetching` and calls
		// `refetch` — a list a person is watching needs a way to ask again.
		isFetching: runs.isFetching,
		refetch: runs.refetch,
	};
}

/**
 * The journal's tiles, counted by the engine over every run in the reader's
 * last *days* — never over the page the table loaded. Its key starts
 * `["runs", owner, graph]`, so whatever refreshes the journal refreshes these.
 */
export function useRunStatsQuery(
	username?: string,
	graphSlug?: string,
	days = 1,
) {
	return useQuery({
		queryKey: ["runs", username, graphSlug, "stats", days] as const,
		queryFn: () =>
			runsApi.stats(username as string, graphSlug as string, { days }),
		enabled: !!username && !!graphSlug,
	});
}

// ── Thinkings behind a task ──────────────────────────────────────────────────

/**
 * The runs a task opened, in the order they were opened.
 *
 * A task's **Thoughts** tab is the same trace the session thread shows, read
 * from the other end: there, a run hangs under the reply that asked for
 * it; here, under the task it was assigned to. Both render through
 * `SessionSteps`, so a step row means one thing in Studio, not two.
 *
 * Fetched per id rather than as a list because that is the endpoint that
 * exists — and a task has one or two runs, not a page of them.
 */
/**
 * Runs as list rows — an agent's **Recent plans** (`agent_id`), a task's runs
 * (`task_id`), or the library's **candidates** (`candidates=true`: generated
 * plans that served and were never promoted).
 */
export function useRunsQuery(
	username: string | undefined,
	graphSlug: string | undefined,
	query: ListQuery = {},
	enabled = true,
) {
	return useQuery({
		queryKey: ["runs", username, graphSlug, listQueryKey(query)] as const,
		queryFn: () => runsApi.list(username as string, graphSlug as string, query),
		enabled: enabled && !!username && !!graphSlug,
		placeholderData: keepPreviousData,
	});
}
