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
 * A settled run reads the engine's stored `duration_ms` (started → finished;
 * a run that sat queued for a minute did not take a minute). A run still
 * going is a live clock against `now`, which is why the journal holds a ticker.
 */
export function elapsedOf(row: RunListRow, now: number): number | null {
	if (row.run.duration_ms != null) return row.run.duration_ms;
	const started = row.run.started_at;
	if (!started || row.run.finished_at) return null;
	return Math.max(0, now - Date.parse(started));
}
