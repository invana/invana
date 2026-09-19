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

export interface RunRow {
	id: string;
	kind: RunKind;
	/** What the run acted on — the records it loaded, or the plan that answered. */
	title: string;
	status: string;
	startedAt: string | null;
	/** The run behind this row. Every row has one; that is the point. */
	run: TaskRunSummary;
}

const LIVE = ["queued", "running"];

/** A plan reads better than an id: `nl-single@1` beats `template:nl-single@1`. */
function askTitle(t: TaskRunSummary): string {
	if (t.task_title) return t.task_title;
	const source = t.plan_origin ?? "";
	if (source.startsWith("template:")) return source.slice("template:".length);
	if (source === "generated") return `${t.workflow_key} · planned`;
	return t.workflow_key;
}

/**
 * A row's title: what the run was about, in the words its opener wrote.
 *
 * A load says `Import news-tv` and an ask says what it was asked, so neither
 * needs a second request to read — which is why `body` is on the list row.
 */
function titleOf(t: TaskRunSummary): string {
	if (t.kind === "import" || t.kind === "bulk") {
		return t.body ?? "records removed";
	}
	return askTitle(t);
}

/**
 * The journal, newest first.
 *
 * `status` narrows here rather than server-side: the endpoint filters by kind,
 * and a status vocabulary shared by every kind of run is the thing S4 settles.
 */
export function useRunsJournalQuery(
	username?: string,
	graphSlug?: string,
	{ status }: { status?: string | null } = {},
) {
	const runs = useQuery({
		queryKey: ["runs", username, graphSlug, "journal"] as const,
		queryFn: () =>
			runsApi.list(username as string, graphSlug as string, { limit: 50 }),
		enabled: !!username && !!graphSlug,
	});

	const rows: RunRow[] = (runs.data?.items ?? [])
		.filter((t) => !status || t.status === status)
		.map((t) => ({
			id: t.id,
			// A run with no kind predates the column; it is an ask, which is
			// what every run was before a load became one.
			kind: (t.kind ?? "ask") as RunKind,
			title: titleOf(t),
			status: t.status,
			startedAt: t.queued_at,
			run: t,
		}))
		.sort((a, b) => (b.startedAt ?? "").localeCompare(a.startedAt ?? ""));

	return {
		rows,
		isLoading: runs.isLoading,
		live: rows.filter((r) => LIVE.includes(r.status)).length,
	};
}
