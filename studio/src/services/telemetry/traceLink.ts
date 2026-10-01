/**
 * Where a trace id opens — the collector's own view of that trace.
 *
 * Usage:
 *
 * ```ts
 * const href = traceUrl(run.trace_id, { start: run.started_at, end: run.finished_at });
 * // href ? <a href={href}>…</a> : the id as plain text
 * ```
 *
 * Design: Studio has no trace viewer of its own; the collector has one. The
 * deployment names it in `VITE_TELEMETRY_TRACE_URL`, a URL template carrying
 * `{trace_id}` — for HyperDX, its search view filtered to that trace id. The
 * id is substituted URL-encoded, every occurrence. Unset, Studio still shows
 * the id, without a link: the id stays useful to paste, and Studio never
 * guesses a collector it was not told about.
 *
 * A collector searches a time range, not all of history, so the template may
 * also carry `{from}` and `{to}` (epoch milliseconds). They are filled from the
 * `window` the caller knows — a run's start and finish, an event's time —
 * widened by a margin on both sides, so the spans just before and after are
 * inside it. With no end the range runs to now; with no window at all it is
 * the last day.
 */

const MARGIN_MS = 15 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface TraceWindow {
	start?: string | null;
	end?: string | null;
}

function epoch(iso: string | null | undefined): number | null {
	if (!iso) return null;
	const ms = Date.parse(iso);
	return Number.isNaN(ms) ? null : ms;
}

function range(window: TraceWindow | undefined, now: number): [number, number] {
	const start = epoch(window?.start);
	const end = epoch(window?.end) ?? now;
	if (start == null) return [end - DAY_MS, end];
	return [start - MARGIN_MS, end + MARGIN_MS];
}

export function traceUrl(
	traceId: string | null | undefined,
	window?: TraceWindow,
	template: string | undefined = import.meta.env.VITE_TELEMETRY_TRACE_URL,
	now: number = Date.now(),
): string | null {
	const id = traceId?.trim();
	const tpl = template?.trim();
	if (!id || !tpl || !tpl.includes("{trace_id}")) return null;
	const [from, to] = range(window, now);
	return tpl
		.replaceAll("{trace_id}", encodeURIComponent(id))
		.replaceAll("{from}", String(from))
		.replaceAll("{to}", String(to));
}
