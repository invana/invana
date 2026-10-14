/**
 * How the journal names a run and times it: the short id a run is quoted by,
 * and the run's own clock
 * (docs/for-developers/modules/operate/features/see-what-ran.md).
 */

import type { RunListRow } from "./queries";

/**
 * The **short id** — the last eight characters, quoted the way a commit is
 * ([see-what-ran.md](docs/for-developers/modules/operate/features/see-what-ran.md)).
 *
 * A run is the noun every other surface names — a log line, `GET …/runs/{id}`,
 * a support thread — so a journal nobody can quote from forces a drill-in just
 * to copy one id.
 */
export function shortRunId(id: string): string {
	return id.replace(/-/g, "").slice(-8);
}

/**
 * The run's own clock, in milliseconds — `null` before it starts.
 *
 * Measured from `started_at`, not from `queued_at`: a run that sat in the
 * queue for a minute did not take a minute. A run still going is measured
 * against `now`, which is why the journal holds a ticker.
 */
export function elapsedOf(row: RunListRow, now: number): number | null {
	const started = row.run.started_at;
	if (!started) return null;
	const end = row.run.finished_at ? Date.parse(row.run.finished_at) : now;
	return Math.max(0, end - Date.parse(started));
}
