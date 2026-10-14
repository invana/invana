/**
 * The records of a dataset's next version, built from its current one.
 *
 * A version is the whole content — the engine mints one from every record,
 * never from a patch — so a few observations, or one value fixed from the
 * validation queue, is the current version's records with that change made.
 * A record's provenance exception rides back as `_provenance`, the key the
 * engine lifts it from, so a re-published record keeps it.
 *
 * Pure: the caller reads the records (`readAll`) and publishes the result.
 */

import type { DatasetRecord } from "./types";

/** Above this many records the form points to the CLI instead. */
export const FORM_LIMIT = 5000;

export type RecordRow = Record<string, unknown>;

/** A read record as the body of the next version takes it. */
function toRow(record: DatasetRecord): RecordRow {
	return record.provenance
		? { ...record.values, _provenance: record.provenance }
		: { ...record.values };
}

/**
 * The current records plus new rows. A new row whose key is already present
 * is refused here, naming it — an observation adds, it never overwrites.
 */
export function withAdded(
	current: DatasetRecord[],
	added: RecordRow[],
	keyColumn: string,
): RecordRow[] {
	const keys = new Set(current.map((r) => r.key));
	for (const row of added) {
		const key = row[keyColumn];
		if (key === undefined || key === null || key === "") {
			throw new Error(`Each observation needs a ${keyColumn}.`);
		}
		if (keys.has(String(key))) {
			throw new Error(
				`${keyColumn} ${String(key)} is already in this dataset — an observation adds a row, it never overwrites one.`,
			);
		}
		keys.add(String(key));
	}
	return [...current.map(toRow), ...added];
}

/** The current records with one property of one record set to `value`. */
export function withValue(
	current: DatasetRecord[],
	key: string,
	property: string,
	value: unknown,
): RecordRow[] {
	if (!current.some((r) => r.key === key)) {
		throw new Error(`No record ${key} in the current version.`);
	}
	return current.map((r) =>
		r.key === key ? { ...toRow(r), [property]: value } : toRow(r),
	);
}

/**
 * A form's text as the value a column holds: a number when it reads as one,
 * empty as null, anything else as typed.
 */
export function coerce(text: string): string | number | null {
	const t = text.trim();
	if (t === "") return null;
	if (/^-?\d+(\.\d+)?$/.test(t)) return Number(t);
	return t;
}
