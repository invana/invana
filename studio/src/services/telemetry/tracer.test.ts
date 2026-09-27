import {
	InMemorySpanExporter,
	SimpleSpanProcessor,
	WebTracerProvider,
} from "@opentelemetry/sdk-trace-web";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { startAction, startClientSpan, withTraceparent } from "./tracer";

const exporter = new InMemorySpanExporter();

beforeAll(() => {
	new WebTracerProvider({
		spanProcessors: [new SimpleSpanProcessor(exporter)],
	}).register();
});

afterEach(() => exporter.reset());

const finished = (name: string) => {
	const span = exporter.getFinishedSpans().find((s) => s.name === name);
	if (!span) throw new Error(`no finished span ${name}`);
	return span;
};

describe("actions and the requests they make", () => {
	it("parents a request on the action it was made for", () => {
		const action = startAction("assistant", "ask");
		startClientSpan("HTTP POST", {}, action).span.end();
		action.end("run.done");

		const ask = finished("ui.assistant.ask");
		const request = finished("HTTP POST");
		expect(request.spanContext().traceId).toBe(ask.spanContext().traceId);
		expect(request.parentSpanContext?.spanId).toBe(ask.spanContext().spanId);
		expect(ask.attributes["invana.outcome"]).toBe("run.done");
	});

	it("makes a request with no action its own root", () => {
		startClientSpan("HTTP GET", {}).span.end();
		expect(finished("HTTP GET").parentSpanContext).toBeUndefined();
	});

	it("ends an action once, and a failure marks it an error", () => {
		const action = startAction("runs", "cancel");
		action.fail(new Error("refused"));
		action.end("requested");

		const spans = exporter
			.getFinishedSpans()
			.filter((s) => s.name === "ui.runs.cancel");
		expect(spans).toHaveLength(1);
		expect(spans[0].attributes["invana.outcome"]).toBe("error");
		expect(spans[0].status.code).toBe(2);
	});
});

describe("withTraceparent", () => {
	it("carries the action's trace on a stream URL and keeps its params", () => {
		const action = startAction("events", "subscribe");
		const url = new URL(
			withTraceparent("http://e/stream?after=3&token=t", action.ctx),
		);
		action.end();

		expect(url.searchParams.get("after")).toBe("3");
		expect(url.searchParams.get("token")).toBe("t");
		expect(url.searchParams.get("traceparent")).toBe(
			`00-${action.span.spanContext().traceId}-${action.span.spanContext().spanId}-01`,
		);
	});
});
