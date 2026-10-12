/**
 * The pure half of simulation in Studio: a simulator's declared spec fields
 * turned into a form draft and back into the spec it sends, and the ranked
 * result read as table columns and as the flat records Save as dataset writes.
 *
 * **The form knows the fields, never the science.** A field's `type` decides
 * its control and how its text is read: `int`/`float` a number, `bool` a
 * switch, `obj` JSON, `list` one entry per line, anything else text. The one
 * shape read out of a list line is a target — `trait >= value` or
 * `trait <= value`, optionally `± sd` — because a target is how a person
 * writes what they want from a cross; every other line goes as its text.
 *
 * **The result is read by contract, not by simulator.** A ranked row has a
 * label (`cross`, else its first text field), `meets_all` (0–1), per-trait
 * `{mean, sd, meets}` under `traits`, and any other plain figure. Nothing here
 * names a trait or a crop.
 */

import type { RankedRow, SpecField } from "../types";

/** The form's state: a text per field, or a flag for a `bool` field. */
export type SpecDraft = Record<string, string | boolean>;

/** A target as the simulator takes it. */
export interface Target {
	trait: string;
	op: ">=" | "<=";
	value: number;
	sd?: number;
}

const TARGET =
	/^(.+?)\s*(>=|<=|≥|≤)\s*(-?\d+(?:\.\d+)?)\s*(?:(?:±|\+-|\+\/-)\s*(\d+(?:\.\d+)?))?$/;

/** One list line: a target when it reads as one, else its trimmed text. */
export function parseListEntry(line: string): Target | string {
	const text = line.trim();
	const m = text.match(TARGET);
	if (!m) return text;
	const target: Target = {
		trait: m[1].trim(),
		op: m[2] === "<=" || m[2] === "≤" ? "<=" : ">=",
		value: Number(m[3]),
	};
	if (m[4] !== undefined) target.sd = Number(m[4]);
	return target;
}

/** A list default back into the line a person would have typed. */
function formatListEntry(entry: unknown): string {
	if (entry && typeof entry === "object") {
		const t = entry as Partial<Target>;
		if (t.trait && t.op && t.value !== undefined)
			return `${t.trait} ${t.op} ${t.value}${t.sd !== undefined ? ` ± ${t.sd}` : ""}`;
		return JSON.stringify(entry);
	}
	return String(entry);
}

/** A fresh draft — every field's default filled in. */
export function specFieldsToDraft(fields: SpecField[]): SpecDraft {
	const draft: SpecDraft = {};
	for (const f of fields) {
		const d = f.default;
		if (f.type === "bool") draft[f.name] = d === true;
		else if (f.type === "list")
			draft[f.name] = Array.isArray(d) ? d.map(formatListEntry).join("\n") : "";
		else if (f.type === "obj")
			draft[f.name] = d == null ? "" : JSON.stringify(d, null, 2);
		else draft[f.name] = d == null ? "" : String(d);
	}
	return draft;
}

/** The field a control is labelled with — its label, else its name. */
export const fieldLabel = (f: SpecField) => f.label || f.name;

/**
 * The spec the draft says, or the first field it cannot be read from. An
 * empty optional field is left out, so the simulator's own default applies.
 */
export function buildSpec(
	fields: SpecField[],
	draft: SpecDraft,
):
	| { spec: Record<string, unknown>; error?: undefined }
	| { error: string; field: string } {
	const spec: Record<string, unknown> = {};
	for (const f of fields) {
		const raw = draft[f.name];
		const label = fieldLabel(f);
		if (f.type === "bool") {
			spec[f.name] = raw === true;
			continue;
		}
		const text = typeof raw === "string" ? raw.trim() : "";
		if (!text) {
			if (f.required) return { error: `${label} is required.`, field: f.name };
			continue;
		}
		if (f.type === "int" || f.type === "float") {
			const n = Number(text.replace(/,/g, ""));
			if (!Number.isFinite(n) || (f.type === "int" && !Number.isInteger(n)))
				return {
					error: `${label} takes ${f.type === "int" ? "a whole number" : "a number"}.`,
					field: f.name,
				};
			spec[f.name] = n;
		} else if (f.type === "list") {
			spec[f.name] = text
				.split("\n")
				.filter((l) => l.trim())
				.map(parseListEntry);
		} else if (f.type === "obj") {
			try {
				spec[f.name] = JSON.parse(text);
			} catch {
				return { error: `${label} is not valid JSON.`, field: f.name };
			}
		} else spec[f.name] = text;
	}
	return { spec };
}

// ── The ranked result ───────────────────────────────────────────────────────

/** Keys the contract gives a meaning of its own; never drawn as a plain column. */
const CONTRACT_KEYS = new Set(["meets_all", "traits"]);

/** The key that labels a row — `cross`, else the first field holding text. */
export function rowLabelKey(rows: RankedRow[]): string {
	if (rows.some((r) => typeof r.cross === "string")) return "cross";
	for (const r of rows)
		for (const [k, v] of Object.entries(r)) if (typeof v === "string") return k;
	return "row";
}

/** Every trait any row carries, in the order first seen. */
export function traitNames(rows: RankedRow[]): string[] {
	const out: string[] = [];
	for (const r of rows)
		for (const t of Object.keys(r.traits ?? {}))
			if (!out.includes(t)) out.push(t);
	return out;
}

/** Every other plain figure — a string, number or boolean — beside the label. */
export function plainKeys(
	rows: RankedRow[],
	labelKey: string,
	skip: string[] = [],
): string[] {
	const out: string[] = [];
	for (const r of rows)
		for (const [k, v] of Object.entries(r)) {
			if (k === labelKey || CONTRACT_KEYS.has(k) || skip.includes(k)) continue;
			if (!["string", "number", "boolean"].includes(typeof v)) continue;
			if (!out.includes(k)) out.push(k);
		}
	return out;
}

/**
 * The ranked rows as flat records: the label, `meets_all`, each trait's
 * `<trait>_mean · _sd · _meets`, then every other plain figure.
 */
export function flattenRows(ranked: RankedRow[]): Record<string, unknown>[] {
	const label = rowLabelKey(ranked);
	const traits = traitNames(ranked);
	const plain = plainKeys(ranked, label);
	return ranked.map((r, i) => {
		const flat: Record<string, unknown> = {
			[label]: r[label] ?? String(i + 1),
			meets_all: r.meets_all ?? null,
		};
		for (const t of traits) {
			const f = r.traits?.[t];
			flat[`${t}_mean`] = f?.mean ?? null;
			flat[`${t}_sd`] = f?.sd ?? null;
			flat[`${t}_meets`] = f?.meets ?? null;
		}
		for (const k of plain) flat[k] = r[k] ?? null;
		return flat;
	});
}

// ── Formatting ──────────────────────────────────────────────────────────────

/** A 0–1 share as a whole percent. */
export const pct = (share: number | undefined | null) =>
	Math.round((share ?? 0) * 100);

/** A figure at a precision its size deserves — `27`, `7.6`, `0.42`. */
export function figure(n: number | undefined | null): string {
	if (n === undefined || n === null || !Number.isFinite(n)) return "—";
	const abs = Math.abs(n);
	const digits = abs >= 100 ? 0 : abs >= 10 ? 1 : 2;
	return n.toLocaleString(undefined, { maximumFractionDigits: digits });
}

/** How long the run took — `41 s`, `2 m 5 s`; null until it has finished. */
export function duration(
	started: string | null,
	finished: string | null,
): string | null {
	if (!started || !finished) return null;
	const s = Math.max(
		0,
		Math.round((Date.parse(finished) - Date.parse(started)) / 1000),
	);
	return s < 60 ? `${s} s` : `${Math.floor(s / 60)} m ${s % 60} s`;
}

const SLUG = /^[a-z0-9][a-z0-9-]{0,62}$/;

/** True when `name` is a dataset name the engine takes. */
export const isSlug = (name: string) => SLUG.test(name);

/** A dataset name from free text — lower-cased, hyphenated, at most 63 long. */
export function toSlug(text: string): string {
	return text
		.toLowerCase()
		.replace(/[^a-z0-9-]+/g, "-")
		.replace(/^[^a-z0-9]+/, "")
		.slice(0, 63)
		.replace(/-+$/, "");
}
