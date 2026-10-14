import { describe, expect, it } from "vitest";
import type { SpecField } from "../types";
import { buildSpec, flattenRows, parseListEntry } from "./specForm";

const field = (over: Partial<SpecField>): SpecField => ({
	name: "f",
	type: "str",
	required: false,
	default: null,
	label: "",
	...over,
});

describe("parseListEntry", () => {
	it("reads a target, with or without a spread", () => {
		expect(parseListEntry("flowering_days <= 32")).toEqual({
			trait: "flowering_days",
			op: "<=",
			value: 32,
		});
		expect(parseListEntry(" seed weight >= 25.5 ± 4 ")).toEqual({
			trait: "seed weight",
			op: ">=",
			value: 25.5,
			sd: 4,
		});
		expect(parseListEntry("height_cm >= 20 +- 1.5")).toMatchObject({ sd: 1.5 });
	});

	it("keeps any other line as its text", () => {
		expect(parseListEntry("  JG 11 ")).toBe("JG 11");
		expect(parseListEntry("height = 20")).toBe("height = 20");
	});
});

describe("buildSpec", () => {
	const fields = [
		field({
			name: "females",
			type: "list",
			required: true,
			label: "Female parents",
		}),
		field({ name: "progeny", type: "int", default: 2000 }),
	];

	it("names a missing required field", () => {
		expect(buildSpec(fields, { females: " ", progeny: "2000" })).toEqual({
			error: "Female parents is required.",
			field: "females",
		});
	});

	it("sends lists line by line and numbers as numbers", () => {
		expect(
			buildSpec(fields, { females: "Col-0\n\nLer-1", progeny: "2,000" }),
		).toEqual({
			spec: { females: ["Col-0", "Ler-1"], progeny: 2000 },
		});
	});
});

describe("flattenRows", () => {
	it("flattens the label, the share and each trait's figures", () => {
		const rows = flattenRows([
			{
				cross: "A × B",
				female: "A",
				male: "B",
				meets_all: 0.41,
				traits: { height: { mean: 20, sd: 2, meets: 0.6 } },
			},
		]);
		expect(rows).toEqual([
			{
				cross: "A × B",
				meets_all: 0.41,
				height_mean: 20,
				height_sd: 2,
				height_meets: 0.6,
				female: "A",
				male: "B",
			},
		]);
	});
});
