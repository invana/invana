/**
 * Canvas traces to the local HyperDX collector — when it is up, and silence when it is not.
 *
 * The canvas reads its telemetry once, when it starts, so the page asks the collector first: one empty OTLP/HTTP
 * trace export with a short timeout. A collector that answers gets `otelTelemetry` (spans for the canvas's views,
 * events and interactions, and its frame metrics); one that is down, refuses the page's origin or is too slow gets no
 * telemetry at all, so no exporter keeps retrying against nothing. The browser still logs the one refused probe.
 *
 * The collector is `VITE_OTEL_ENDPOINT` at build time, `http://localhost:4318` by default — the OTLP/HTTP port the
 * repo's `docker-compose.yml` publishes for HyperDX.
 */
import type { CanvasTelemetryConfig } from "@invana/canvas";
import { otelTelemetry } from "@invana/canvas-telemetry-otel";

/** The OTLP/HTTP base URL the probe and the exporters use. */
export const OTEL_ENDPOINT: string =
	import.meta.env.VITE_OTEL_ENDPOINT ?? "http://localhost:4318";

/** The service name the spans carry in HyperDX. */
export const SERVICE_NAME = "invana-spec-graph";

/** `true` when an OTLP/HTTP collector answers at `endpoint` within `timeoutMs`. Never throws. */
export async function collectorUp(
	endpoint: string,
	timeoutMs = 1500,
	fetchImpl: typeof fetch = fetch,
): Promise<boolean> {
	try {
		const r = await fetchImpl(`${endpoint}/v1/traces`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ resourceSpans: [] }),
			signal: AbortSignal.timeout(timeoutMs),
		});
		return r.ok;
	} catch {
		return false;
	}
}

/** The canvas telemetry for the page: traces and metrics to the collector when it is up, else `undefined`. */
export async function pageTelemetry(
	endpoint = OTEL_ENDPOINT,
): Promise<CanvasTelemetryConfig | undefined> {
	if (!(await collectorUp(endpoint))) return undefined;
	return otelTelemetry({
		endpoint,
		serviceName: SERVICE_NAME,
		traces: true,
		metrics: true,
		logging: "info",
	});
}
