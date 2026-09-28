/**
 * Span helpers: one trace per user action, from the click to its outcome.
 *
 * An **action** is the root span for something a person means to do — ask the
 * assistant, stop a run, promote a plan — named `ui.<module>.<action>`
 * (`ui.assistant.ask`). `startAction` opens it and returns a handle; the caller
 * ends it when the action's outcome arrives, which for an ask is the run
 * stream's terminal frame, not the POST that started it.
 *
 * Everything the action causes is parented **explicitly** on the handle's
 * `ctx`, never through ambient context: an action crosses React renders,
 * TanStack Query's async hops and native async/await, and no web context
 * manager carries the active context across those. So:
 *
 * - an API call made for an action passes it in its request config
 *   (`{ action }`); the API client opens a CLIENT span under it and injects
 *   `traceparent`, so the engine's request span joins the same trace. A call
 *   with no action is its own root — every call is traced, none is an orphan;
 * - a stream opened for an action carries the action's `traceparent` in its
 *   URL (`withTraceparent`), because `EventSource` cannot send headers;
 * - the Explorer's canvas stages (transform → adapt → layout → render) are
 *   children of the `ui.explorer.load` action, via `startChild` / `measureSync`.
 *
 * Action spans carry who and where — `enduser.id`, `invana.graph`,
 * `invana.session_id` — never what was asked or answered.
 *
 * When telemetry is disabled no provider is registered, so `trace.getTracer`
 * returns OTel's no-op tracer and every helper here costs nothing.
 */
import {
	type Context,
	context,
	propagation,
	ROOT_CONTEXT,
	type Span,
	SpanKind,
	SpanStatusCode,
	trace,
} from "@opentelemetry/api";
import { recordAction } from "./metrics";

export type SpanAttributes = Record<string, string | number | boolean>;

const TRACER_NAME = "invana-studio";

/** A span and the context to parent its children on. */
export interface Interaction {
	readonly span: Span;
	readonly ctx: Context;
}

/** A user action in flight. End it exactly once, with its outcome. */
export interface Action extends Interaction {
	/** End the action; `outcome` is recorded as `invana.outcome`. Idempotent. */
	end(outcome?: string): void;
	/** Record `err` on the action and end it with outcome `error`. Idempotent. */
	fail(err: unknown): void;
	readonly ended: boolean;
}

/** Mutable holder threaded through the Explorer so canvas stages share one trace. */
export type InteractionRef = { current: Interaction | null };

let currentUserId: () => string | null | undefined = () => undefined;

/**
 * Tell telemetry how to read the signed-in user's id, recorded on every action
 * as `enduser.id`. Registered by the auth store at load, so this module never
 * imports the store.
 */
export function registerTelemetryUser(
	read: () => string | null | undefined,
): void {
	currentUserId = read;
}

function tracer() {
	return trace.getTracer(TRACER_NAME);
}

/**
 * Open the root span for a user action, `ui.<module>.<action>`. It starts a new
 * trace — never a child of whatever else is on screen — and stays open until
 * the handle's `end` or `fail` is called.
 *
 * Ending the handle also records one `ui.action.duration` point, labelled with
 * the module, the action and the outcome (`ok` when none is given, `error` on
 * `fail`) — so action latency is a metric even where the trace was sampled out.
 */
export function startAction(
	module: string,
	action: string,
	attributes?: SpanAttributes,
): Action {
	const userId = currentUserId();
	const span = tracer().startSpan(
		`ui.${module}.${action}`,
		{
			attributes: {
				"invana.module": module,
				"invana.action": action,
				...(userId ? { "enduser.id": userId } : {}),
				...attributes,
			},
		},
		ROOT_CONTEXT,
	);
	const started = performance.now();
	let ended = false;
	const end = (outcome?: string) => {
		if (ended) return;
		ended = true;
		if (outcome) span.setAttribute("invana.outcome", outcome);
		span.end();
		recordAction(
			module,
			action,
			outcome ?? "ok",
			(performance.now() - started) / 1000,
		);
	};
	return {
		span,
		ctx: trace.setSpan(ROOT_CONTEXT, span),
		end,
		fail: (err: unknown) => {
			if (ended) return;
			if (err instanceof Error) span.recordException(err);
			span.setStatus({ code: SpanStatusCode.ERROR });
			end("error");
		},
		get ended() {
			return ended;
		},
	};
}

/** Run `fn` with the interaction's context active, for synchronous children. */
export function withInteraction<T>(interaction: Interaction, fn: () => T): T {
	return context.with(interaction.ctx, fn);
}

/** Start a child span under the interaction. The caller owns `.end()`. */
export function startChild(
	interaction: Interaction,
	name: string,
	attributes?: SpanAttributes,
): Span {
	return tracer().startSpan(name, { attributes }, interaction.ctx);
}

/**
 * Start an HTTP **client** span and return it with the context to inject
 * `traceparent` from, so the engine's request span nests under it.
 *
 * Parented on `parent` — the action the call was made for — or, with none, a
 * root of its own. The caller owns `.end()` (the API client's response
 * interceptors).
 */
export function startClientSpan(
	name: string,
	attributes: SpanAttributes,
	parent?: Interaction,
): { span: Span; ctx: Context } {
	const parentCtx = parent?.ctx ?? ROOT_CONTEXT;
	const span = tracer().startSpan(
		name,
		{ kind: SpanKind.CLIENT, attributes },
		parentCtx,
	);
	return { span, ctx: trace.setSpan(parentCtx, span) };
}

/**
 * Append the context's `traceparent` (and `tracestate`, when there is one) to a
 * URL's query string. For `EventSource`, which cannot send headers; the engine
 * reads the parameter when the header is absent. Returns the URL unchanged when
 * there is nothing to propagate (telemetry off).
 */
export function withTraceparent(url: string, ctx: Context): string {
	const carrier: Record<string, string> = {};
	propagation.inject(ctx, carrier);
	const params = Object.entries(carrier)
		.filter(([key]) => key === "traceparent" || key === "tracestate")
		.map(([key, value]) => `${key}=${encodeURIComponent(value)}`);
	if (params.length === 0) return url;
	return `${url}${url.includes("?") ? "&" : "?"}${params.join("&")}`;
}

/**
 * Measure a synchronous stage as a child span under the interaction; ends it
 * automatically. A plain `fn(null)` call when there is no interaction (e.g. a
 * session restore that did not come from a fresh load).
 */
export function measureSync<T>(
	interaction: Interaction | null,
	name: string,
	fn: (span: Span | null) => T,
	attributes?: SpanAttributes,
): T {
	if (!interaction) return fn(null);
	const span = startChild(interaction, name, attributes);
	try {
		return context.with(trace.setSpan(interaction.ctx, span), () => fn(span));
	} finally {
		span.end();
	}
}

/** End the interaction's root span and clear the ref that holds it. */
export function endInteraction(
	ref: InteractionRef,
	interaction: Interaction,
): void {
	if ("end" in interaction && typeof interaction.end === "function") {
		(interaction as Action).end();
	} else {
		interaction.span.end();
	}
	if (ref.current === interaction) ref.current = null;
}
