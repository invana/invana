import { describe, expect, it } from "vitest";
import { traceUrl } from "./traceLink";

const TEMPLATE =
	"http://hdx/search?isLive=false&where=TraceId%3D%27{trace_id}%27&from={from}&to={to}";

describe("traceUrl", () => {
	it("fills the id and a range around the window", () => {
		const start = "2026-09-28T10:00:00Z";
		const end = "2026-09-28T10:01:00Z";
		const margin = 15 * 60 * 1000;
		expect(traceUrl("0af7651916cd43dd", { start, end }, TEMPLATE)).toBe(
			`http://hdx/search?isLive=false&where=TraceId%3D%270af7651916cd43dd%27&from=${Date.parse(start) - margin}&to=${Date.parse(end) + margin}`,
		);
	});

	it("links nothing without an id or a template", () => {
		expect(traceUrl("0af7651916cd43dd", {}, "")).toBeNull();
		expect(traceUrl("0af7651916cd43dd", {}, undefined)).toBeNull();
		expect(traceUrl(null, {}, TEMPLATE)).toBeNull();
	});
});
