import { metrics } from "@opentelemetry/api";
import {
	AggregationTemporality,
	type DataPoint,
	type Histogram,
	InMemoryMetricExporter,
	MeterProvider,
	PeriodicExportingMetricReader,
} from "@opentelemetry/sdk-metrics";
import { beforeAll, describe, expect, it } from "vitest";
import { moduleOf, routeTemplate } from "./metrics";
import { startAction } from "./tracer";

const exporter = new InMemoryMetricExporter(AggregationTemporality.CUMULATIVE);
const reader = new PeriodicExportingMetricReader({
	exporter,
	exportIntervalMillis: 60_000,
});

beforeAll(() => {
	metrics.setGlobalMeterProvider(new MeterProvider({ readers: [reader] }));
});

describe("routeTemplate", () => {
	it("keeps the route and drops every value in it", () => {
		const route = routeTemplate(
			"http://localhost:8200/api/v1/u/ravi/airways/runs/0b6c1f4e-8f1a-4c7e-9d2a-3f5e6a7b8c9d/stream?after=3&token=t",
		);
		expect(route).toBe("/api/v1/u/:username/:graph/runs/:id/stream");
		expect(
			routeTemplate("/api/v1/u/ravi/airways/task-plans/weekly-report/export"),
		).toBe("/api/v1/u/:username/:graph/task-plans/:id/export");
	});
});

describe("moduleOf", () => {
	it("names the module on a Graph's page, and anything else is other", () => {
		expect(moduleOf("/u/ravi/airways", "?panel=library")).toBe("plans");
		expect(moduleOf("/u/ravi/airways", "")).toBe("explorer");
		expect(moduleOf("/somewhere/unknown")).toBe("other");
		expect(moduleOf("/u/ravi/airways", "?panel=not-a-panel")).toBe("other");
	});
});

describe("ui.action.duration", () => {
	it("records one point when an action ends, with its module, action and outcome", async () => {
		const action = startAction("runs", "cancel");
		action.fail(new Error("refused"));
		action.end("requested");

		await reader.forceFlush();
		const metric = exporter
			.getMetrics()
			.flatMap((r) => r.scopeMetrics)
			.flatMap((s) => s.metrics)
			.find((m) => m.descriptor.name === "ui.action.duration");
		const points = (metric?.dataPoints ?? []) as DataPoint<Histogram>[];

		expect(metric?.descriptor.unit).toBe("s");
		expect(points).toHaveLength(1);
		expect(points[0].attributes).toEqual({
			module: "runs",
			action: "cancel",
			outcome: "error",
		});
		expect(points[0].value.count).toBe(1);
	});
});
