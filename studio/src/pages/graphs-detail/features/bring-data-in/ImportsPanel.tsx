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

import type { JournalRow } from "@/hooks/queries/useRuns";
import { useTicker } from "@/hooks/useTicker";
import { formatCompact } from "@/lib/format";
import { formatElapsed, formatRelativeTime } from "@/lib/time";
import { EmptyState, RunRow, Spinner } from "@invana/ui";

/**
 * The journal body — the rows, and nothing else.
 *
 * It is a **drawer body**, not a panel: the Runs drawer draws the title, the
 * count, the search, the funnel and the chip row it opens above it, and the panel draws the status bar
 * below (graph-detail-page.md G32 · G33). The rows are read once, by the panel,
 * because the header count and the status bar read them too.
 *
 * Its drill-in is the URL's (`&run=`), because a drawer's detail replaces that
 * drawer's body and has to survive a reload like any other region (G31).
 */
export interface ImportsJournalBodyProps {
	rows: JournalRow[];
	isLoading: boolean;
	/** The run whose detail replaces the list, from `&run=`. */
	runId: string | null;
	onOpenRun: (id: string | null) => void;
	/** A chip or the search is narrowing the list — words the empty state. */
	narrowed: boolean;
}

export function ImportsJournalBody({
	rows,
	isLoading,
	runId,
	onOpenRun,
	narrowed,
}: ImportsJournalBodyProps) {
	return (
		<Journal
			rows={rows}
			isLoading={isLoading}
			selectedId={runId}
			narrowed={narrowed}
			onOpenRun={onOpenRun}
		/>
	);
}

/**
 * The **short id** — the last eight characters, quoted the way a commit is
 * ([SR45](docs/for-developers/modules/operate/features/see-what-ran.md)).
 *
 * A run is the noun every other surface names — a log line, `GET …/runs/{id}`,
 * a support thread — so a journal nobody can quote from forces a drill-in just
 * to copy one id.
 */
function shortRunId(id: string): string {
	return id.replace(/-/g, "").slice(-8);
}

/**
 * The run's own clock, in milliseconds — `null` before it starts (SR34).
 *
 * Measured from `started_at`, not from `queued_at`: a run that sat in the
 * queue for a minute did not take a minute. A run still going is measured
 * against `now`, which is why the journal holds a ticker.
 */
function elapsedOf(row: JournalRow, now: number): number | null {
	const started = row.run.started_at;
	if (!started) return null;
	const end = row.run.finished_at ? Date.parse(row.run.finished_at) : now;
	return Math.max(0, end - Date.parse(started));
}

/**
 * The line under a row, after its id: the plan, what the run spent, then when
 * it was opened.
 *
 * `nl-query@5 · 2m 51s · 21.4k · 9/9 · 4 mins ago` (SR45). Each fact drops out
 * when nobody recorded it rather than reading as zero (SR34) — a load spends
 * no tokens, and a queued run has no elapsed.
 *
 * `9/9` is a **position**, not a percentage: a plan can replan, and a count
 * that goes backwards is worse than no count. The step's *label* is not here —
 * *which* step it is on is what the drill-in answers.
 */
function runLine(row: JournalRow, now: number): string {
	const t = row.run;
	const parts: string[] = [row.plan];

	const elapsed = elapsedOf(row, now);
	if (elapsed !== null) parts.push(formatElapsed(elapsed));

	const tokens = (t.tokens_in ?? 0) + (t.tokens_out ?? 0);
	if (tokens > 0) parts.push(formatCompact(tokens));

	if (t.steps_total > 0) parts.push(`${t.steps_done}/${t.steps_total}`);

	if (t.served && t.served !== "yes") parts.push(`served ${t.served}`);
	// A bulk load validated nothing, and the row says so rather than letting it
	// read like a checked one (IW11).
	if (row.kind === "bulk") parts.push("bulk, unvalidated");

	if (row.startedAt) parts.push(formatRelativeTime(new Date(row.startedAt)));
	return parts.join(" · ");
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
	selectedId,
	narrowed,
	onOpenRun,
}: {
	rows: JournalRow[];
	isLoading: boolean;
	selectedId: string | null;
	/** Only to word the empty state — the controls are the chips above (G33). */
	narrowed: boolean;
	onOpenRun: (id: string) => void;
}) {
	const live = rows.filter((row) => isLive(row.status)).length;
	// A running run's elapsed has to move on its own — nothing refetches this
	// list every second. No live row, no timer.
	const now = useTicker(live > 0);

	return (
		<div className="min-h-0 flex-1 overflow-y-auto">
			{isLoading ? (
				<div className="p-4">
					<Spinner />
				</div>
			) : rows.length === 0 ? (
				// Empty because nothing has run, not because something is
				// broken — so the empty state is the command, not an apology.
				<EmptyState
					className="p-4"
					title={narrowed ? "No runs match" : "Nothing has run yet"}
					description={
						narrowed ? (
							"Nothing in this Graph matches these filters."
						) : (
							<>
								Invana is the destination. Whatever already extracts your data
								writes a folder, then calls{" "}
								<code className="font-mono text-sm">
									invana records import --model &lt;name&gt;
								</code>
								. A run appears here the moment it starts.
								<span className="mt-2 block">
									<code className="font-mono text-sm">invana loader</code> is
									the fast path — pass{" "}
									<code className="font-mono text-sm">
										--graph &lt;username&gt;/&lt;slug&gt;
									</code>{" "}
									and its load appears here too, marked as the bulk load it is.
								</span>
							</>
						)
					}
				/>
			) : (
				rows.map((row) => (
					// The status is the glyph, not a word (SR65). A run that
					// succeeded but served only part of an answer says so by
					// shape as well as on line two.
					<RunRow
						key={row.id}
						status={row.status}
						state={
							row.status === "succeeded" && row.run.served === "partial"
								? ("alert" as const)
								: undefined
						}
						title={row.title}
						titleMono={row.isQuery}
						address={shortRunId(row.id)}
						meta={runLine(row, now)}
						selected={row.id === selectedId}
						onSelect={() => onOpenRun(row.id)}
					/>
				))
			)}
		</div>
	);
}

const isLive = (status: string): boolean =>
	status === "queued" || status === "running";
