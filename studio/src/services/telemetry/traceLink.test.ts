import { describe, expect, it } from "vitest";
import { traceUrl } from "./traceLink";

describe("traceUrl", () => {
	it("substitutes the trace id into the template", () => {
		expect(
			traceUrl(
				"0af7651916cd43dd",
				"http://hdx/search?where=TraceId%3D%27{trace_id}%27",
			),
		).toBe("http://hdx/search?where=TraceId%3D%270af7651916cd43dd%27");
	});

	it("links nothing without an id or a template", () => {
		expect(traceUrl("0af7651916cd43dd", "")).toBeNull();
		expect(traceUrl("0af7651916cd43dd", undefined)).toBeNull();
		expect(traceUrl(null, "http://hdx/trace/{trace_id}")).toBeNull();
	});
});
