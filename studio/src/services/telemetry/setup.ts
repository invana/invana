/**
 * OpenTelemetry-Web bootstrap (RFC-025).
 *
 * Registers a WebTracerProvider that ships spans — via the engine's OTLP/HTTP
 * proxy (`/api/v1/telemetry/traces`) — to the collector, and the default W3C
 * trace-context propagator so the API client can inject a `traceparent` on the
 * message call. That stitches the studio's spans and the engine's into one
 * distributed trace per query.
 *
 * The FE→BE link is propagated *explicitly* in the API client (see
 * services/api/client.ts → `startClientSpan`), not via auto-XHR
 * instrumentation: the request crosses TanStack Query's async hops, and no web
 * context manager carries the active context across Vite's native async/await
 * (zone.js only patches down-levelled awaits). See RFC-025 D3.
 *
 * Gated by `VITE_TELEMETRY_ENABLED` (on unless explicitly "false"). When off,
 * `setup()` is a no-op: no provider is registered, so the helpers in ./tracer
 * resolve to OTel's no-op tracer and the Explorer instrumentation costs nothing.
 *
 * Imported for side-effect from main.tsx before the app renders.
 */
import { DiagConsoleLogger, DiagLogLevel, diag } from "@opentelemetry/api";
import { ZoneContextManager } from "@opentelemetry/context-zone";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { resourceFromAttributes } from "@opentelemetry/resources";
import {
	BatchSpanProcessor,
	WebTracerProvider,
} from "@opentelemetry/sdk-trace-web";

const API_BASE_URL =
	import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8200";

// On unless explicitly disabled — mirrors the engine's INVANA_TELEMETRY_ENABLED
// default (true). Set VITE_TELEMETRY_ENABLED=false to turn studio tracing off.
const ENABLED = import.meta.env.VITE_TELEMETRY_ENABLED !== "false";

// Verbose OTel logging — the full per-request firehose, including benign
// "ignoring span as url matches ignored url" lines for the exporter's own POSTs.
// Opt-in via VITE_TELEMETRY_DEBUG=true. Otherwise dev still surfaces warnings /
// errors (e.g. failed exports) and prod stays silent.
const DEBUG = import.meta.env.VITE_TELEMETRY_DEBUG === "true";

/** Tracer name shared with ./tracer's span helpers. */
export const SERVICE_NAME = "invana-studio";

/** Full URL of the engine's browser-span proxy (RFC-025). */
const TRACES_URL = `${API_BASE_URL}/api/v1/telemetry/traces`;

function setup(): void {
	if (!ENABLED) return;

	if (DEBUG) diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.DEBUG);
	else if (import.meta.env.DEV)
		diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.WARN);

	try {
		const provider = new WebTracerProvider({
			resource: resourceFromAttributes({
				"service.name": SERVICE_NAME,
				"service.version": import.meta.env.VITE_APP_VERSION ?? "0.0.0",
				"deployment.environment": import.meta.env.MODE,
				"invana.component": "studio",
			}),
			// OTel JS 2.x takes processors in the constructor (addSpanProcessor is gone).
			spanProcessors: [
				new BatchSpanProcessor(
					new OTLPTraceExporter({
						url: TRACES_URL,
						// As of OTel JS 0.219 the browser exporter always ships over
						// `fetch` (keepalive) — not navigator.sendBeacon — so the
						// cross-origin `application/json` POST satisfies the CORS
						// preflight (the engine proxy allows it) instead of being
						// silently dropped. The exporter already sets Content-Type
						// itself; this line is now redundant but kept explicit so the
						// intended content type is obvious at the call site.
						headers: { "Content-Type": "application/json" },
					}),
				),
			],
		});

		// Registers the default W3C trace-context propagator (used by the API
		// client to inject `traceparent`) and a synchronous context manager for
		// the explicit `context.with` in ./tracer's stage spans. We don't lean on
		// it to bridge async hops — those use explicit `interaction.ctx`.
		provider.register({ contextManager: new ZoneContextManager() });

		if (import.meta.env.DEV) {
			// eslint-disable-next-line no-console
			console.info(
				`[telemetry] studio tracing on → spans exporting to ${TRACES_URL}`,
			);
		}
	} catch (err) {
		// Telemetry must never break the app — log loudly and carry on.
		// eslint-disable-next-line no-console
		console.error("[telemetry] setup failed — studio tracing disabled", err);
	}
}

setup();
