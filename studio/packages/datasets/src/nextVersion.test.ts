import { describe, expect, it } from "vitest";
import { coerce, withAdded, withValue } from "./nextVersion";
import type { DatasetRecord } from "./types";

const current: DatasetRecord[] = [
	{
		key: "Col-0",
		version: 2,
		values: { id: "Col-0", days: 48 },
		provenance: null,
	},
	{
		key: "Ler-1",
		version: 2,
		values: { id: "Ler-1", days: 51 },
		provenance: { origin: "official", source: "ABRC" },
	},
];

describe("the next version's records", () => {
	it("adds observations and keeps each provenance exception", () => {
		const rows = withAdded(
			current,
			[{ id: "Cvi-0", days: coerce(" 62 ") }],
			"id",
		);
		expect(rows).toEqual([
			{ id: "Col-0", days: 48 },
			{
				id: "Ler-1",
				days: 51,
				_provenance: { origin: "official", source: "ABRC" },
			},
			{ id: "Cvi-0", days: 62 },
		]);
		expect(withValue(current, "Col-0", "days", 50)[0]).toEqual({
			id: "Col-0",
			days: 50,
		});
	});

	it("refuses an observation without a key, or one that would overwrite", () => {
		expect(() => withAdded(current, [{ days: 3 }], "id")).toThrow(/needs a id/);
		expect(() => withAdded(current, [{ id: "Col-0" }], "id")).toThrow(
			/already in this dataset/,
		);
		expect(() => withValue(current, "Sha", "days", 1)).toThrow(/No record Sha/);
		expect(coerce("")).toBeNull();
	});
});
