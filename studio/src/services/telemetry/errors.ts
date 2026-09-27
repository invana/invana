/**
 * Studio errors as telemetry: one OTLP log record per error a person hit, on
 * the trace it happened in, and one `ui.errors` count beside it.
 *
 * Usage:
 *
 * ```ts
 * reportError(event.error, "uncaught");                 // done by ./setup
 * reportError(event.reason, "unhandled_rejection");     // done by ./setup
 * if (shouldReport(err)) reportError(err, "query");      // the query client's error hook
 * reportError(err, "route");                             // the router's error page
 * reportError(err, "boundary", "explorer");             // a region's error boundary
 * ```
 *
 * Each report is one ERROR-severity record from the `invana-studio` logger:
 *
 * | Field | Value |
 * |---|---|
 * | body | the error's message |
 * | `exception.type` | the error's name (`TypeError`, `ApiError`), or its JS type |
 * | `exception.message` | the error's message |
 * | `exception.stacktrace` | the stack, when the error has one |
 * | `module` | the Studio module on screen, or the one the caller names |
 * | `ui.error.source` | where it was caught: `uncaught` · `unhandled_rejection` · `boundary` · `route` · `query` · `mutation` |
 *
 * The record is emitted in a context, so the log joins its trace: the one the
 * caller passes (an action's `ctx`, say), else the client span of the request
 * that failed (an `ApiError` carries it), else whatever context is active when
 * the error is reported. An error reported with neither carries no trace id —
 * it is still counted and still logged.
 *
 * Design: only errors travel. Warnings and console output stay in the browser's
 * devtools; a log line the person did not suffer is noise on the collector. And
 * not every failed request is an error: a 4xx is the engine refusing something
 * the screen already explains, and a cancelled request is one the person
 * stopped — {@link shouldReport} says no to both, so only a network failure or
 * a 5xx is reported. A 4xx is still counted by `ui.request.duration` as an
 * `error` outcome; it is just not logged.
 *
 * One error object is reported once: the same `Error` can surface through a
 * query's error hook and then again, rethrown, as an uncaught error, and it is
 * one thing that went wrong.
 *
 * When telemetry is off, ./setup registers no logger provider, the global is
 * OTel's no-op, and a report costs one counter call on the no-op meter.
 */
import {
	type Context,
	ROOT_CONTEXT,
	type SpanContext,
	isSpanContextValid,
	context as otelContext,
	trace,
} from "@opentelemetry/api";
import {
	type LogAttributes,
	SeverityNumber,
	logs,
} from "@opentelemetry/api-logs";
import { type ErrorSource, moduleOf, recordError } from "./metrics";

/** Logger name — the same service name traces and metrics report under. */
const LOGGER_NAME = "invana-studio";

export type { ErrorSource };

/** Error objects already reported — each one is logged once. */
const reported = new WeakSet<object>();

/** Browser noise that is not a failure: the ResizeObserver loop notice. */
const BENIGN =
	/^ResizeObserver loop (limit exceeded|completed with undelivered notifications)/;

/** The HTTP status an error carries — our `ApiError`, or axios's own error. */
function statusOf(error: unknown): number | undefined {
	if (typeof error !== "object" || error === null) return undefined;
	const { status, response } = error as {
		status?: unknown;
		response?: { status?: unknown };
	};
	if (typeof status === "number") return status;
	if (typeof response?.status === "number") return response.status;
	return undefined;
}

/** A request the person (or a newer request) called off — not a failure. */
function isCancelled(error: unknown): boolean {
	if (typeof error !== "object" || error === null) return false;
	const { name, code } = error as { name?: unknown; code?: unknown };
	if (name === "AbortError" || name === "CanceledError") return true;
	return (
		code === "ERR_CANCELED" ||
		(error as { cancelled?: unknown }).cancelled === true
	);
}

/**
 * The context an error belongs to: the failed request's client span when the
 * error carries one (the API client's `ApiError` does), else the active context.
 */
function contextOf(error: unknown): Context {
	const spanContext = (error as { spanContext?: SpanContext } | null)
		?.spanContext;
	if (
		spanContext &&
		typeof spanContext === "object" &&
		isSpanContextValid(spanContext)
	) {
		return trace.setSpanContext(ROOT_CONTEXT, spanContext);
	}
	return otelContext.active();
}

/**
 * Whether an error is worth a log record. No for a 4xx response (the screen
 * handles it), a cancelled request, and the browser's ResizeObserver notice;
 * yes for everything else — a network failure, a 5xx, a thrown bug.
 */
export function shouldReport(error: unknown): boolean {
	const status = statusOf(error);
	if (status !== undefined && status >= 400 && status < 500) return false;
	if (isCancelled(error)) return false;
	return !BENIGN.test(messageOf(error));
}

function messageOf(error: unknown): string {
	if (error instanceof Error) return error.message;
	if (typeof error === "string") return error;
	try {
		return JSON.stringify(error) ?? String(error);
	} catch {
		return String(error);
	}
}

function typeOf(error: unknown): string {
	if (error instanceof Error) return error.name || "Error";
	return error === null ? "null" : typeof error;
}

/** The module on screen, or `other` where there is no page (a test, a worker). */
function currentModule(): string {
	if (typeof window === "undefined") return "other";
	return moduleOf(window.location.pathname, window.location.search);
}

/**
 * Log one error as an ERROR record and count it in `ui.errors`.
 *
 * `module` defaults to the module on screen. `ctx` is the context the error
 * belongs to — pass an action's `ctx` when the error is that action's — and
 * defaults to the failed request's span when the error carries one, else the
 * active context. Callers filter with {@link shouldReport}
 * where the rule applies (failed requests); this function reports what it is
 * given, except an error object it has already reported.
 */
/**
 * A region's error boundary hook: `<ErrorBoundary onError={reportBoundaryError}>`.
 * Reports the caught error with source `boundary`, under the module on screen.
 */
export function reportBoundaryError(error: Error): void {
	reportError(error, "boundary");
}

export function reportError(
	error: unknown,
	source: ErrorSource,
	module: string = currentModule(),
	ctx: Context = contextOf(error),
): void {
	if (typeof error === "object" && error !== null) {
		if (reported.has(error)) return;
		reported.add(error);
	}
	const message = messageOf(error);
	const attributes: LogAttributes = {
		"exception.type": typeOf(error),
		"exception.message": message,
		module,
		"ui.error.source": source,
	};
	if (error instanceof Error && error.stack) {
		attributes["exception.stacktrace"] = error.stack;
	}
	logs.getLogger(LOGGER_NAME).emit({
		severityNumber: SeverityNumber.ERROR,
		severityText: "ERROR",
		body: message,
		attributes,
		context: ctx,
	});
	recordError(module, source);
}
