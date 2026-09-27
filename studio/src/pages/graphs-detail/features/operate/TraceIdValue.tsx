/**
 * A trace id, as a row value — the first sixteen characters, monospace.
 *
 * Usage: `<TraceIdValue id={run.trace_id} />` wherever a `trace` row is drawn
 * (the run drawer's `The run`, an event's detail).
 *
 * When the deployment names its collector's trace view
 * (`VITE_TELEMETRY_TRACE_URL`), the id is a link that opens the trace there,
 * in a new tab; otherwise it is the id alone. The full id rides in the
 * tooltip either way, so it can be read or copied whole.
 */

import { traceUrl } from "@/services/telemetry/traceLink";
import { Link } from "@invana/ui";

export function TraceIdValue({ id }: { id: string }) {
	const href = traceUrl(id);
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
