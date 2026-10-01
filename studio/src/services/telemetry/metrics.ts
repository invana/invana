/**
 * Studio metrics: how long actions and requests take, how the page feels, and
 * how often a live stream drops — as numbers a dashboard can chart, not traces.
 *
 * Usage:
 *
 * ```ts
 * recordAction("assistant", "ask", "run.done", 4.2);  // done by startAction's handle
 * recordRequest("/api/v1/u/foo/bar/runs/42", "ok", 0.08);  // done by the API client
 * recordWebVital("lcp", 1830, "explorer");             // done by ./setup
 * recordStreamReconnect("run");                        // done by the stream clients
 * recordError("explorer", "query");                    // done by ./errors' reportError
 * ```
 *
 * Instruments:
 *
 * | Name | Kind | Unit | Attributes |
 * |---|---|---|---|
 * | `ui.action.duration` | histogram | s | `module` · `action` · `outcome` |
 * | `ui.request.duration` | histogram | s | `http.route` · `outcome` |
 * | `ui.web_vitals.lcp` · `.inp` · `.ttfb` | histogram | ms | `module` |
 * | `ui.web_vitals.cls` | histogram | 1 | `module` |
 * | `ui.stream.reconnects` | counter | 1 | `stream` |
 * | `ui.errors` | counter | 1 | `module` · `source` |
 *
 * Design: every attribute is drawn from a small, bounded set, so a metric's
 * series count never grows with the people, Graphs or runs using Studio. That
 * is why `http.route` is a route *template* ({@link routeTemplate}), never the
 * URL — a URL carries a username, a Graph's slug and record ids — and why a
 * web vital is labelled with the Studio module on screen ({@link moduleOf}),
 * never the path. Who acted and on what belongs on the trace, not here.
 *
 * Instruments are resolved from the global meter provider on use. When
 * telemetry is off, ./setup registers none, the global is OTel's no-op and
 * every function here costs next to nothing.
 */
import {
	type Counter,
	type Histogram,
	type Meter,
	metrics,
} from "@opentelemetry/api";

const METER_NAME = "invana-studio";

/** Seconds — the HTTP semantic-convention buckets, stretched for long actions. */
const SECONDS_BUCKETS = [
	0.005, 0.01, 0.025, 0.05, 0.075, 0.1, 0.25, 0.5, 0.75, 1, 2.5, 5, 7.5, 10, 30,
	60, 120, 300,
];
/** Milliseconds — spans the good / needs-improvement / poor thresholds of LCP, INP and TTFB. */
const MS_BUCKETS = [
	50, 100, 200, 300, 500, 800, 1000, 1800, 2500, 4000, 6000, 10000, 20000,
];
/** Layout-shift score — around CLS's 0.1 and 0.25 thresholds. */
const CLS_BUCKETS = [0.01, 0.05, 0.1, 0.15, 0.25, 0.5, 1];

export type WebVital = "lcp" | "inp" | "cls" | "ttfb";
export type StreamKind = "run" | "events";
/** Where an error was caught — the `source` of a `ui.errors` point. */
export type ErrorSource =
	| "uncaught"
	| "unhandled_rejection"
	| "boundary"
	| "route"
	| "query"
	| "mutation";

interface Instruments {
	action: Histogram;
	request: Histogram;
	vitals: Record<WebVital, Histogram>;
	reconnects: Counter;
	errors: Counter;
}

let cached: { meter: Meter; instruments: Instruments } | null = null;

function vital(meter: Meter, name: WebVital, unit: string, buckets: number[]) {
	return meter.createHistogram(`ui.web_vitals.${name}`, {
		unit,
		description: `Core Web Vital ${name.toUpperCase()}, per Studio module.`,
		advice: { explicitBucketBoundaries: buckets },
	});
}

/**
 * The instruments on the current global meter. Re-created only when the global
 * provider changes (it is set once, by ./setup — or by a test), because an
 * instrument made on the no-op meter would stay a no-op forever.
 */
function instruments(): Instruments {
	const meter = metrics.getMeter(METER_NAME);
	if (cached?.meter === meter) return cached.instruments;
	const made: Instruments = {
		action: meter.createHistogram("ui.action.duration", {
			unit: "s",
			description: "Time from a user action to its outcome.",
			advice: { explicitBucketBoundaries: SECONDS_BUCKETS },
		}),
		request: meter.createHistogram("ui.request.duration", {
			unit: "s",
			description: "Time from an API request to its response, seen by Studio.",
			advice: { explicitBucketBoundaries: SECONDS_BUCKETS },
		}),
		vitals: {
			lcp: vital(meter, "lcp", "ms", MS_BUCKETS),
			inp: vital(meter, "inp", "ms", MS_BUCKETS),
			ttfb: vital(meter, "ttfb", "ms", MS_BUCKETS),
			cls: vital(meter, "cls", "1", CLS_BUCKETS),
		},
		reconnects: meter.createCounter("ui.stream.reconnects", {
			unit: "1",
			description: "Times a live stream dropped and the browser reconnected.",
		}),
		errors: meter.createCounter("ui.errors", {
			unit: "1",
			description: "Errors a person hit in Studio, by module and where caught.",
		}),
	};
	cached = { meter, instruments: made };
	return made;
}

/** Record one finished user action. `outcome` is the one its span records. */
export function recordAction(
	module: string,
	action: string,
	outcome: string,
	seconds: number,
): void {
	instruments().action.record(seconds, { module, action, outcome });
}

/** Record one finished API request; `url` is reduced to its route template. */
export function recordRequest(
	url: string,
	outcome: "ok" | "error",
	seconds: number,
): void {
	instruments().request.record(seconds, {
		"http.route": routeTemplate(url),
		outcome,
	});
}

/** Record one Web Vitals report for the module on screen. */
export function recordWebVital(
	name: WebVital,
	value: number,
	module: string,
): void {
	instruments().vitals[name].record(value, { module });
}

/** Count one drop of a live stream that the browser is reconnecting. */
export function recordStreamReconnect(stream: StreamKind): void {
	instruments().reconnects.add(1, { stream });
}

/** Count one error Studio reported, by the module on screen and where it was caught. */
export function recordError(module: string, source: ErrorSource): void {
	instruments().errors.add(1, { module, source });
}

/**
 * Every fixed word in an engine API path Studio calls. A path segment outside
 * this list is a value — an id, a key, a slug — and becomes `:id`. An endpoint
 * added later without its words here reads as `…/:id` rather than leaking a
 * value: the error is always toward fewer series, never toward a name.
 */
const ROUTE_WORDS = new Set([
	"accept",
	"accounts",
	"acknowledge-version",
	"activate",
	"active-version",
	"activity",
	"agents",
	"api",
	"archive",
	"ask",
	"assignments",
	"auth",
	"board",
	"boards",
	"by-edge-type",
	"by-node-type",
	"cancel",
	"capabilities",
	"catalogue",
	"citations",
	"clarifications",
	"commit",
	"compare",
	"connection",
	"constraints",
	"context",
	"deactivate",
	"default-agent",
	"dependencies",
	"diff",
	"discard",
	"draft",
	"draw",
	"duplicate",
	"edge-types",
	"emissions",
	"events",
	"expand",
	"explore",
	"export",
	"feedback",
	"global-model",
	"graph-connectors",
	"graphs",
	"health",
	"impact",
	"import",
	"indexes",
	"inlinable",
	"insights",
	"introspect",
	"lenses",
	"lineage",
	"llm",
	"login",
	"logout",
	"me",
	"messages",
	"meters",
	"metrics",
	"model-links",
	"models",
	"neighbors",
	"node-types",
	"operations",
	"participants",
	"password",
	"pause",
	"performance",
	"personal-access-tokens",
	"ping",
	"plan",
	"platform",
	"preview",
	"projection",
	"projection-templates",
	"projects",
	"promote",
	"property-keys",
	"publish",
	"query",
	"refresh",
	"reject",
	"remove",
	"resolve",
	"result",
	"resume",
	"retire",
	"rules",
	"run",
	"runs",
	"schema",
	"schemas",
	"sessions",
	"set-default",
	"setup",
	"shapes",
	"skills",
	"skills-and-callables",
	"soul",
	"staged",
	"start",
	"starters",
	"stream",
	"task-plans",
	"tasks",
	"telemetry",
	"template",
	"templates",
	"test",
	"tokens",
	"touches",
	"trace",
	"traces",
	"traversal",
	"type-counts",
	"types",
	"u",
	"upgrade",
	"usage",
	"username-available",
	"v1",
	"validate",
	"version",
	"versions",
]);

/**
 * Reduce a request URL to its route template — `/api/v1/u/:username/:graph/runs/:id`.
 *
 * Drops the origin, query and fragment; the two segments after `/u/` are
 * always the owner and the Graph; every other segment is kept only if it is a
 * known route word, else it becomes `:id`. Absolute and relative URLs both work.
 */
export function routeTemplate(url: string): string {
	const path = url.replace(/^[a-z]+:\/\/[^/]+/i, "").split(/[?#]/, 1)[0];
	const segments = path.split("/").filter(Boolean);
	const owner = segments.indexOf("u") + 1;
	const out = segments.map((segment, i) => {
		if (owner > 0 && i === owner) return ":username";
		if (owner > 0 && i === owner + 1) return ":graph";
		return ROUTE_WORDS.has(segment.toLowerCase()) ? segment : ":id";
	});
	return `/${out.join("/")}`;
}

/** A Graph page's `?panel` value → the Studio module it opens. */
const PANEL_MODULES: Record<string, string> = {
	explorer: "explorer",
	model: "model",
	schema: "model",
	runs: "runs",
	library: "plans",
	projects: "projects",
	govern: "govern",
	agents: "agents",
	skills: "skills",
	sessions: "assistant",
	messages: "assistant",
};

/**
 * The Studio module on screen for a location — a bounded label for web vitals.
 *
 * On a Graph's page the open `?panel` names it, and with none the page is the
 * Explorer's canvas. Outside a Graph the first path segment names it. Anything
 * unrecognised is `other`, so the label set never grows with the URL.
 */
export function moduleOf(pathname: string, search = ""): string {
	const segments = pathname.split("/").filter(Boolean);
	if (segments[0] === "u" && segments.length >= 3) {
		const panel = new URLSearchParams(search).get("panel");
		if (!panel) return segments.length === 3 ? "explorer" : "other";
		return PANEL_MODULES[panel] ?? "other";
	}
	switch (segments[0]) {
		case "graphs":
			return "graphs";
		case "login":
			return "login";
		case "settings":
			return "settings";
		case "platform":
			return segments[1] === "events" ? "events" : "other";
		default:
			return "other";
	}
}
