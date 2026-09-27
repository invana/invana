/**
 * A trace id, as a row value — the first sixteen characters, monospace.
 *
 * Usage: `<TraceIdValue id={run.trace_id} window={{ start, end }} />` wherever
 * a `trace` row is drawn (the run drawer's `The run`, an event's detail). The
 * window is when the record happened — the collector's view opens on it.
 *
 * When the deployment names its collector's trace view
 * (`VITE_TELEMETRY_TRACE_URL`), the id is a link that opens the trace there,
 * in a new tab; otherwise it is the id alone. The full id rides in the
 * tooltip either way, so it can be read or copied whole.
 */

import { type TraceWindow, traceUrl } from "@/services/telemetry/traceLink";
import { Link } from "@invana/ui";

export function TraceIdValue({
	id,
	window,
}: {
	id: string;
	window?: TraceWindow;
}) {
	const href = traceUrl(id, window);
	const short = `${id.slice(0, 16)}…`;
	if (!href) {
		return (
			<code className="font-mono" title={id}>
				{short}
			</code>
		);
	}
	return (
		<Link href={href} external className="font-mono" title={id}>
			{short}
		</Link>
	);
}
