/**
 * Span helpers for the Explorer query→render pipeline (RFC-025).
 *
 * An "interaction" is the root span for one user action (a query run). Its OTel
 * `Context` is threaded — via a ref — across the async React renders that follow
 * (request → transform → adapt → layout → render), so every stage nests under one
 * trace. Each stage opens its child against the stored `interaction.ctx`
 * *explicitly* (not via ambient context), because the pipeline crosses async
 * boundaries React/TanStack Query schedule that no web context manager carries
 * reliably under Vite's native async/await (see RFC-025 D3 addendum).
 *
 * The in-flight interaction is also mirrored in a module-level slot so the API
 * client can parent its outgoing-HTTP span to the run and inject W3C
 * trace-context — without threading the context through TanStack Query's
 * mutation machinery. See `startClientSpan`.
 *
 * When telemetry is disabled no provider is registered, so `trace.getTracer`
 * returns OTel's no-op tracer and every helper here is free.
 */
import {
	type Context,
	type Span,
	SpanKind,
	context,
	trace,
} from "@opentelemetry/api";

export type SpanAttributes = Record<string, string | number | boolean>;

const TRACER_NAME = "invana-studio";

export interface Interaction {
	readonly span: Span;
	readonly ctx: Context;
}

/** Mutable holder threaded through the Explorer so stages share one trace. */
export type InteractionRef = { current: Interaction | null };

function tracer() {
	return trace.getTracer(TRACER_NAME);
}

/**
 * The query run currently in flight (one at a time). Mirrors the Explorer's
 * runRef at module scope so `startClientSpan` can reach it from the axios
 * interceptor — where the call stack has long since left `handleRun`'s context.
 */
let activeInteraction: Interaction | null = null;

/** Open a root interaction span for a user action (e.g. running a query). */
export function startInteraction(
	name: string,
	attributes?: SpanAttributes,
): Interaction {
	// Safety net (RFC-026 D4): if a prior interaction never closed — e.g. an
	// error path that skipped endInteraction, or a new trigger firing mid-render
	// — end it so consecutive runs don't collapse into a single trace.
	if (activeInteraction) {
		activeInteraction.span.end();
		activeInteraction = null;
	}
	const span = tracer().startSpan(name, { attributes });
	const ctx = trace.setSpan(context.active(), span);
	const interaction: Interaction = { span, ctx };
	activeInteraction = interaction;
	return interaction;
}

/** Run `fn` with the interaction's context active, so child/XHR spans nest. */
export function withInteraction<T>(interaction: Interaction, fn: () => T): T {
	return context.with(interaction.ctx, fn);
}

/** Start a child span under the interaction. Caller owns `.end()`. */
export function startChild(
	interaction: Interaction,
	name: string,
	attributes?: SpanAttributes,
): Span {
	return tracer().startSpan(name, { attributes }, interaction.ctx);
}

/**
 * Start an HTTP **client** span and return it alongside the context to inject
 * W3C trace headers from — so the engine's request span (and its backend
 * subtree) nests under it.
 *
 * - During an Explorer run, the span nests under the in-flight interaction's
 *   `explorer.query.run`.
 * - Outside a run, it nests only when `standalone` is set — used for
 *   session/message API ops, which get their own one-span distributed trace
 *   (RFC-026 D3). Other API calls pass `standalone: false` and stay untraced.
 *
 * Returns null when there's nothing to trace. The caller owns `.end()` (see the
 * API client's response interceptors).
 */
export function startClientSpan(
	name: string,
	attributes?: SpanAttributes,
	options?: { standalone?: boolean },
): { span: Span; ctx: Context } | null {
	const interaction = activeInteraction;
	// In a run → nest under it; else if standalone → a fresh root (context.active
	// is empty here); else nothing to trace.
	const parentCtx = interaction
		? interaction.ctx
		: options?.standalone
			? context.active()
			: null;
	if (!parentCtx) return null;
	const span = tracer().startSpan(
		name,
		{ kind: SpanKind.CLIENT, attributes },
		parentCtx,
	);
	return { span, ctx: trace.setSpan(parentCtx, span) };
}

/**
 * Measure a synchronous stage as a child span under the interaction; ends it
 * automatically. No-ops to a plain `fn(null)` call when there's no interaction
 * (e.g. a session restore that didn't originate from a fresh run).
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

/** End the interaction's root span and clear the ref + module-level slot. */
export function endInteraction(
	ref: InteractionRef,
	interaction: Interaction,
): void {
	interaction.span.end();
	if (ref.current === interaction) ref.current = null;
	if (activeInteraction === interaction) activeInteraction = null;
}
