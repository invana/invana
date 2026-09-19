/**
 * Runs — the journal (docs/for-developers/modules/bring-data-in/features/inspect-what-landed.md IW7).
 *
 * One list of runs in the Graph, newest first. **The journal is filtered, not
 * selective** (SR23): a load, an ask, a stitch commit and a bulk load are all
 * TaskRuns, and *what kind* is a column rather than a surface of its own.
 *
 * There is no dataset facet any more, and no dataset detail. Records belong to
 * a model, so *what landed* is a question about a model and its runs — the
 * second record that used to sit between them is gone
 * ([§ 6.7](docs/for-developers/building-engine/task-model-migration.md)). A row
 * names what the run was about, and the drill-in is the run.
 *
 * Nothing here writes (IW3). Loading is CLI and API only (BD6).
 */

import { type RunRow, useRunsJournalQuery } from "@/hooks/queries/useRuns";
import { formatRelativeTime } from "@/lib/time";
import { WorkRow } from "@/pages/graphs-detail/shared/WorkRow";
import type { Tone } from "@/pages/graphs-detail/shared/statusTone";
import { PanelStatusBar, StatusCount, StatusCrumb } from "@/ui/PanelStatusBar";
import { EmptyState, Spinner } from "@invana/ui";

const STATUSES: readonly string[] = [
	"running",
	"succeeded",
	"failed",
	"cancelled",
];

/**
 * The journal body — everything the Runs drawer draws, minus its chrome.
 *
 * It is a **drawer body**, not a panel: `Runs` is the first drawer of the Tasks
 * stack, and the drawer draws the title, the count, the search and the filter
 * above it (graph-detail-page.md G32 · G33).
 *
 * Its drill-in is the URL's (`&run=`), because a drawer's detail replaces that
 * drawer's body and has to survive a reload like any other region (G31).
 */
export interface ImportsJournalBodyProps {
	username: string;
	graphSlug: string;
	/** The run whose detail replaces the list, from `&run=`. */
	runId: string | null;
	onOpenRun: (id: string | null) => void;
	/** The status the drawer's funnel is filtering on. */
	status: string | null;
}

export function ImportsJournalBody({
	username,
	graphSlug,
	status,
	onOpenRun,
}: ImportsJournalBodyProps) {
	const journal = useRunsJournalQuery(username, graphSlug, { status });
	return (
		<Journal
			rows={journal.rows}
			isLoading={journal.isLoading}
			status={status}
			onOpenRun={onOpenRun}
		/>
	);
}

/**
 * The statuses the journal filters on, offered by the Runs drawer's funnel.
 */
export const IMPORT_STATUSES = STATUSES;

/**
 * The line under a row: what the run has done, then when.
 *
 * `Execute 5/7` is the furthest step that is not merely queued, which is the
 * one fact a reader scanning a journal wants from a run still in flight. It
 * reads the same for a load, because a load is a run: `Write 2/4`.
 */
function runLine(row: RunRow): string {
	const t = row.run;
	const progress =
		t.steps_total > 0
			? `${t.step_label ?? "Queued"} ${t.steps_done}/${t.steps_total}`
			: (t.step_label ?? "Queued");
	const when = row.startedAt ? formatRelativeTime(new Date(row.startedAt)) : "";
	const served = t.served && t.served !== "yes" ? ` · served ${t.served}` : "";
	// A bulk load validated nothing, and the row says so rather than letting it
	// read like a checked one (IW11).
	const unaudited = row.kind === "bulk" ? " · bulk, unvalidated" : "";
	return [progress + served + unaudited, when].filter(Boolean).join(" · ");
}

/**
 * The journal itself: one row per run, newest first.
 *
 * The row says what ran, how far it got and when — so the list can be read
 * without opening anything, which is the whole point of an audit journal.
 */
function Journal({
	rows,
	isLoading,
	status,
	onOpenRun,
}: {
	rows: RunRow[];
	isLoading: boolean;
	/** Only to word the empty state — the control itself is the drawer's funnel (G33). */
	status: string | null;
	onOpenRun: (id: string) => void;
}) {
	const live = rows.filter((row) => isLive(row.status)).length;

	return (
		<div className="flex h-full min-h-0 flex-col">
			<div className="flex-1 overflow-y-auto">
				{isLoading ? (
					<div className="p-4">
						<Spinner />
					</div>
				) : rows.length === 0 ? (
					// Empty because nothing has run, not because something is
					// broken — so the empty state is the command, not an apology.
					<EmptyState
						className="p-4"
						title={status ? `No ${status} runs` : "Nothing has run yet"}
						description={
							status ? (
								"Nothing in this Graph finished that way."
							) : (
								<>
									Invana is the destination. Whatever already extracts your data
									writes a folder, then calls{" "}
									<code className="font-mono text-xs">
										invana records import --model &lt;name&gt;
									</code>
									. A run appears here the moment it starts.
									<span className="mt-2 block">
										<code className="font-mono text-xs">invana loader</code> is
										the fast path — pass{" "}
										<code className="font-mono text-xs">
											--graph &lt;username&gt;/&lt;slug&gt;
										</code>{" "}
										and its load appears here too, marked as the bulk load it
										is.
									</span>
								</>
							)
						}
					/>
				) : (
					rows.map((row) => (
						<WorkRow
							key={row.id}
							onClick={() => onOpenRun(row.id)}
							tone={toneFor(row.status)}
							live={isLive(row.status)}
							title={row.title}
							subtitle={<span className="truncate">{runLine(row)}</span>}
							status={row.status}
							statusTone={toneFor(row.status)}
						/>
					))
				)}
			</div>

			<PanelStatusBar
				left={<StatusCrumb active>Runs</StatusCrumb>}
				middle={
					live
						? [
								<StatusCount key="live" tone="running">
									{live} running
								</StatusCount>,
							]
						: []
				}
				right="loading is CLI and API"
			/>
		</div>
	);
}

const isLive = (status: string): boolean =>
	status === "queued" || status === "running";

/** A run's status, in the shared vocabulary (statusTone.ts). */
function toneFor(status: string | null): Tone {
	if (status === "failed") return "error";
	if (status === "running") return "running";
	if (status === "succeeded") return "success";
	return "muted";
}
