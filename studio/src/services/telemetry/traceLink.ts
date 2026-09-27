/**
 * Where a trace id opens — the collector's own view of that trace.
 *
 * Usage:
 *
 * ```ts
 * const href = traceUrl(run.trace_id);
 * // href ? <a href={href}>…</a> : the id as plain text
 * ```
 *
 * Design: Studio has no trace viewer of its own; the collector has one. The
 * deployment names it in `VITE_TELEMETRY_TRACE_URL`, a URL template carrying
 * `{trace_id}` — for HyperDX, its search view filtered to that trace id. The
 * id is substituted URL-encoded, every occurrence. Unset, Studio still shows
 * the id, without a link: the id stays useful to paste, and Studio never
 * guesses a collector it was not told about.
 */
export function traceUrl(
	traceId: string | null | undefined,
	template: string | undefined = import.meta.env.VITE_TELEMETRY_TRACE_URL,
): string | null {
	const id = traceId?.trim();
	const tpl = template?.trim();
	if (!id || !tpl || !tpl.includes("{trace_id}")) return null;
	return tpl.replaceAll("{trace_id}", encodeURIComponent(id));
}
