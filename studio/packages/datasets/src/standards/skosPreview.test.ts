import { describe, expect, it } from "vitest";
import type { SkosImportResult } from "../types";
import { conceptCount, levelCount, schemesIn } from "./skosPreview";

const result = (terms: SkosImportResult["terms"]): SkosImportResult => ({
	address: "admin/traits",
	scheme_iri: "http://ex.org/scheme",
	title: "Traits",
	terms,
	unchanged: false,
	report: {
		format: "turtle",
		triples: 0,
		mapped: {},
		skipped: [],
		skipped_count: 0,
		notes: [],
		notes_count: 0,
	},
});

describe("skosPreview", () => {
	it("counts a hierarchy's concepts and levels", () => {
		const r = result([
			{
				name: "Seed",
				iri: "http://ex.org/seed",
				values: [
					{ code: "size" },
					{ code: "small", broader: "size" },
					{ code: "large", broader: "size" },
				],
			},
		]);
		expect(conceptCount(r)).toBe(4);
		expect(levelCount(r)).toBe(3);
	});

	it("reads a flat scheme as one level, and names the schemes a refusal lists", () => {
		const r = result([
			{ name: "Traits", iri: "http://ex.org/scheme", values: [{ code: "a" }] },
		]);
		expect(conceptCount(r)).toBe(1);
		expect(levelCount(r)).toBe(1);
		expect(
			schemesIn(
				"The file holds 2 concept schemes; name one with scheme: http://a.org/s, http://b.org/s.",
			),
		).toEqual(["http://a.org/s", "http://b.org/s"]);
		expect(schemesIn("No SKOS concepts in the file.")).toEqual([]);
	});
});
