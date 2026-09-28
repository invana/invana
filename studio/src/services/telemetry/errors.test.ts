import { metrics } from "@opentelemetry/api";
import { logs, SeverityNumber } from "@opentelemetry/api-logs";
import {
	InMemoryLogRecordExporter,
	LoggerProvider,
	SimpleLogRecordProcessor,
} from "@opentelemetry/sdk-logs";
import {
	AggregationTemporality,
	type DataPoint,
	InMemoryMetricExporter,
	MeterProvider,
	PeriodicExportingMetricReader,
} from "@opentelemetry/sdk-metrics";
import {
	InMemorySpanExporter,
	SimpleSpanProcessor,
	WebTracerProvider,
} from "@opentelemetry/sdk-trace-web";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { ApiError } from "@/services/api/client";
import { reportError, shouldReport } from "./errors";
import { startAction, withInteraction } from "./tracer";

const logExporter = new InMemoryLogRecordExporter();
const metricExporter = new InMemoryMetricExporter(
	AggregationTemporality.CUMULATIVE,
);
const reader = new PeriodicExportingMetricReader({
	exporter: metricExporter,
	exportIntervalMillis: 60_000,
});

beforeAll(() => {
	new WebTracerProvider({
		spanProcessors: [new SimpleSpanProcessor(new InMemorySpanExporter())],
	}).register();
	logs.setGlobalLoggerProvider(
		new LoggerProvider({
			processors: [new SimpleLogRecordProcessor(logExporter)],
		}),
	);
	metrics.setGlobalMeterProvider(new MeterProvider({ readers: [reader] }));
});

afterEach(() => logExporter.reset());

async function errorCounts() {
	await reader.forceFlush();
	const metric = metricExporter
		.getMetrics()
		.flatMap((r) => r.scopeMetrics)
		.flatMap((s) => s.metrics)
		.find((m) => m.descriptor.name === "ui.errors");
	return (metric?.dataPoints ?? []) as DataPoint<number>[];
}

describe("reportError", () => {
	it("logs one error on the trace it happened in, and counts it", async () => {
		const action = startAction("explorer", "load");
		const error = new TypeError("layout exploded");
		withInteraction(action, () => reportError(error, "boundary", "explorer"));
		reportError(error, "uncaught", "explorer"); // the same error, rethrown
		action.end();

		const records = logExporter.getFinishedLogRecords();
		expect(records).toHaveLength(1);
		const [record] = records;
		expect(record.severityNumber).toBe(SeverityNumber.ERROR);
		expect(record.body).toBe("layout exploded");
		expect(record.spanContext?.traceId).toBe(action.span.spanContext().traceId);
		expect(record.attributes).toMatchObject({
			"exception.type": "TypeError",
			"exception.message": "layout exploded",
			module: "explorer",
			"ui.error.source": "boundary",
		});
		expect(record.attributes["exception.stacktrace"]).toContain("TypeError");

		const counts = await errorCounts();
		expect(counts).toHaveLength(1);
		expect(counts[0].attributes).toEqual({
			module: "explorer",
			source: "boundary",
		});
		expect(counts[0].value).toBe(1);
	});
});

describe("a failed request", () => {
	it("is logged in the trace of the request that failed", () => {
		const action = startAction("assistant", "ask");
		const error = new ApiError(503, "Service unavailable", undefined, {
			spanContext: action.span.spanContext(),
		});
		action.end();
		reportError(error, "query", "assistant");

		const [record] = logExporter.getFinishedLogRecords();
		expect(record.spanContext?.traceId).toBe(action.span.spanContext().traceId);
	});
});

describe("shouldReport", () => {
	it("reports a 5xx and a network failure", () => {
		expect(shouldReport(new ApiError(503, "Service unavailable"))).toBe(true);
		expect(shouldReport(new ApiError(0, "Network Error"))).toBe(true);
	});

	it("leaves a 4xx and a cancelled request to the screen", () => {
		expect(shouldReport(new ApiError(404, "Not found"))).toBe(false);
		// A third-party refusal, fetched outside the API client, carries its status too.
		expect(
			shouldReport(
				Object.assign(new Error("GitHub API responded 403"), { status: 403 }),
			),
		).toBe(false);
		expect(shouldReport(new ApiError(422, "name — Field required"))).toBe(
			false,
		);
		expect(
			shouldReport(new ApiError(0, "canceled", undefined, { cancelled: true })),
		).toBe(false);
		expect(logExporter.getFinishedLogRecords()).toHaveLength(0);
	});
});
