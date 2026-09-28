import { describe, expect, it } from "vitest";
import { fromTypeStylingPatch, toTypeStylingPatch } from "./stylingPatch";

describe("stylingPatch", () => {
	it("round-trips a stored label property through the kit's label key", () => {
		const stored = {
			nodeTypes: { airport: { color: "crimson", labelProperty: "code" } },
			edgeTypes: { route: { width: 2 } },
		};
		const patch = toTypeStylingPatch(stored);
		expect(patch.nodeTypes?.airport).toEqual({
			color: "crimson",
			labelKey: "data.code",
		});
		expect(fromTypeStylingPatch(patch)).toEqual(stored);
	});

	it("adds no key to an unstyled label, and stores a root key as the default", () => {
		expect(
			toTypeStylingPatch({ nodeTypes: { airport: { size: 8 } } }).nodeTypes,
		).toEqual({ airport: { size: 8 } });
		expect(
			fromTypeStylingPatch({ nodeTypes: { airport: { labelKey: "type" } } })
				.nodeTypes,
		).toEqual({ airport: {} });
	});
});
