/**
 * OpenTelemetry-Web bootstrap (docs/for-developers/modules/platform/features/telemetry.md).
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
 * (zone.js only patches down-levelled awaits). See docs/for-developers/modules/platform/features/telemetry.md.
 *
 * Sampling is parent-based on `VITE_TELEMETRY_SAMPLE_RATIO` (0–1, default 1):
 * a new action is kept at that ratio, and the engine honours the decision the
 * `traceparent` carries, so a kept action keeps its whole trace. The ratio is
 * recorded on the resource so a missing trace is explainable.
 *
 * Metrics ride beside the traces: a MeterProvider with the same resource
 * exports through the engine's `/api/v1/telemetry/metrics` proxy every 30s, in
 * delta temporality — each tab is a short-lived process that shares its
 * resource with every other tab, so it reports what happened since its last
 * export rather than a running total. The pending points are flushed when the
 * page is hidden or unloaded, the last moment a tab is sure to have. Core Web
 * Vitals (LCP, INP, CLS, TTFB) are fed in here from `web-vitals`, labelled with
 * the Studio module on screen; the other instruments are fed where they happen
 * (see ./metrics).
 *
 * Gated by `VITE_TELEMETRY_ENABLED` (on unless explicitly "false"). When off,
 * `setup()` is a no-op: no provider is registered, so the helpers in ./tracer
 * and ./metrics resolve to OTel's no-ops and the instrumentation costs nothing.
 *
 * Imported for side-effect from main.tsx before the app renders.
 */
import {
	DiagConsoleLogger,
	DiagLogLevel,
	diag,
	metrics,
} from "@opentelemetry/api";
import { ZoneContextManager } from "@opentelemetry/context-zone";
import {
	AggregationTemporalityPreference,
	OTLPMetricExporter,
} from "@opentelemetry/exporter-metrics-otlp-http";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { resourceFromAttributes } from "@opentelemetry/resources";
import {
	MeterProvider,
	PeriodicExportingMetricReader,
} from "@opentelemetry/sdk-metrics";
import {
	BatchSpanProcessor,
	ParentBasedSampler,
	TraceIdRatioBasedSampler,
	WebTracerProvider,
} from "@opentelemetry/sdk-trace-web";
import { onCLS, onINP, onLCP, onTTFB } from "web-vitals";
import { type WebVital, moduleOf, recordWebVital } from "./metrics";
import { sampleRatio } from "./sampling";

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

const SAMPLE_RATIO = sampleRatio(import.meta.env.VITE_TELEMETRY_SAMPLE_RATIO);

/** Tracer name shared with ./tracer's span helpers. */
export const SERVICE_NAME = "invana-studio";

/** Full URL of the engine's browser-span proxy (docs/for-developers/modules/platform/features/telemetry.md). */
const TRACES_URL = `${API_BASE_URL}/api/v1/telemetry/traces`;

/** Full URL of the engine's browser-metrics proxy. */
const METRICS_URL = `${API_BASE_URL}/api/v1/telemetry/metrics`;

/** How often pending metric points are exported. */
const METRIC_EXPORT_INTERVAL_MS = 30_000;

/** Who is reporting — shared by traces and metrics, so the two join. */
function studioResource() {
	return resourceFromAttributes({
		"service.name": SERVICE_NAME,
		"service.version": import.meta.env.VITE_APP_VERSION ?? "0.0.0",
		"deployment.environment": import.meta.env.MODE,
		"invana.component": "studio",
		"invana.telemetry.sample_ratio": SAMPLE_RATIO,
	});
}

/**
 * Register the global MeterProvider, flush it whenever the tab may be about to
 * go, and feed it the Core Web Vitals. Each vital is labelled with the module
 * on screen when it is reported.
 */
function setupMetrics(resource: ReturnType<typeof studioResource>): void {
	const provider = new MeterProvider({
		resource,
		readers: [
			new PeriodicExportingMetricReader({
				exporter: new OTLPMetricExporter({
					url: METRICS_URL,
					temporalityPreference: AggregationTemporalityPreference.DELTA,
				}),
				exportIntervalMillis: METRIC_EXPORT_INTERVAL_MS,
			}),
		],
	});
	metrics.setGlobalMeterProvider(provider);

	const flush = () => {
		provider.forceFlush().catch(() => undefined);
	};
	window.addEventListener("pagehide", flush);
	document.addEventListener("visibilitychange", () => {
		if (document.visibilityState === "hidden") flush();
	});

	const report =
		(name: WebVital) =>
		({ value }: { value: number }) =>
			recordWebVital(
				name,
				value,
				moduleOf(window.location.pathname, window.location.search),
			);
	onLCP(report("lcp"));
	onINP(report("inp"));
	onCLS(report("cls"));
	onTTFB(report("ttfb"));
}

function setup(): void {
	if (!ENABLED) return;

	if (DEBUG) diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.DEBUG);
	else if (import.meta.env.DEV)
		diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.WARN);

	try {
		const resource = studioResource();
		const provider = new WebTracerProvider({
			resource,
			sampler: new ParentBasedSampler({
				root: new TraceIdRatioBasedSampler(SAMPLE_RATIO),
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

		setupMetrics(resource);

		if (import.meta.env.DEV) {
			// eslint-disable-next-line no-console
			console.info(
				`[telemetry] studio telemetry on → spans to ${TRACES_URL}, metrics to ${METRICS_URL}`,
			);
		}
	} catch (err) {
		// Telemetry must never break the app — log loudly and carry on.
		// eslint-disable-next-line no-console
		console.error(
			"[telemetry] setup failed — studio telemetry is partly or wholly off",
			err,
		);
	}
}

setup();
