/**
 * Pure readings of an ontology import's result, for `OntologyImportDialog`.
 *
 * The engine returns a report (mapped types, skipped constructs, notes, stitch
 * suggestions) and the draft it would create. The dialog draws two things from
 * them: the picker's rows (every class, with where it comes from) and the
 * preview's *Mapping — source → Invana* table, one row per thing the import
 * did or declined to do. Both are computed here so they can be tested without
 * a DOM.
 *
 * ```ts
 * const rows = pickerRows(catalogue.report);       // the classes to pick from
 * const mapping = mappingRows(preview);             // node · edge · stitch · skipped
 * compactIri("https://schema.org/Person");          // "schema:Person"
 * ```
 */

import type {
	MappedType,
	OntologyImportResult,
	OntologyReport,
} from "../../types";

const PREFIXES: [RegExp, string][] = [
	[/^https?:\/\/(www\.)?schema\.org\//, "schema:"],
	[/^http:\/\/www\.w3\.org\/2002\/07\/owl#/, "owl:"],
	[/^http:\/\/www\.w3\.org\/2000\/01\/rdf-schema#/, "rdfs:"],
	[/^http:\/\/www\.w3\.org\/1999\/02\/22-rdf-syntax-ns#/, "rdf:"],
	[/^http:\/\/www\.w3\.org\/2001\/XMLSchema#/, "xsd:"],
];

/** The part of an IRI after its last `#` or `/`. */
function localName(iri: string): string {
	const cut = Math.max(iri.lastIndexOf("#"), iri.lastIndexOf("/"));
	return cut >= 0 && cut < iri.length - 1 ? iri.slice(cut + 1) : iri;
}

/** `schema:Person`, `owl:Restriction`, else the IRI's local name. */
export function compactIri(iri: string): string {
	for (const [pattern, prefix] of PREFIXES) {
		if (pattern.test(iri)) return prefix + iri.replace(pattern, "");
	}
	return localName(iri);
}

/** Where a class comes from — the host of an http(s) IRI, else its prefix. */
export function namespaceLabel(iri: string): string {
	const http = /^https?:\/\/([^/#?]+)/i.exec(iri);
	if (http) return http[1].replace(/^www\./, "");
	const cut = Math.max(iri.lastIndexOf("#"), iri.lastIndexOf("/"));
	if (cut > 0) return iri.slice(0, cut);
	const colon = iri.indexOf(":");
	return colon > 0 ? iri.slice(0, colon) : iri;
}

/** The classes an all-classes preview found — what the picker lists. */
export function pickerRows(report: OntologyReport): MappedType[] {
	return report.types.filter((t) => t.kind === "node");
}

/** A picker row matches a search on its name, its IRI, or where it comes from. */
export function matchesSearch(row: MappedType, query: string): boolean {
	const q = query.trim().toLowerCase();
	if (!q) return true;
	return (
		row.name.toLowerCase().includes(q) || row.iri.toLowerCase().includes(q)
	);
}

/** `Person, Organization` → `["Person", "Organization"]`, blanks dropped. */
export function parseTypeNames(text: string): string[] {
	return text
		.split(",")
		.map((s) => s.trim())
		.filter(Boolean);
}

type MappingKind = "node" | "edge" | "stitch" | "skipped";

export interface MappingRow {
	key: string;
	kind: MappingKind;
	source: string;
	/** The Invana name it becomes; absent for a stitch suggestion or a skip. */
	name?: string;
	note: string;
}

const SUGGESTION_WORD: Record<string, string> = {
	same_as: "sameAs",
	equivalent_class: "equivalentClass",
	equivalent_property: "equivalentProperty",
};

const plural = (n: number, one: string, many = `${one}s`) =>
	`${n} ${n === 1 ? one : many}`;

/** Node types, then edge types, then stitch suggestions, then what was skipped. */
export function mappingRows(result: OntologyImportResult): MappingRow[] {
	const { report, draft } = result;
	const rows: MappingRow[] = [];
	for (const t of report.types.filter((t) => t.kind === "node")) {
		let note = plural(t.properties.length, "property", "properties");
		if (t.came_with) note += ` · came with ${t.came_with}`;
		if (t.inherited.length) note += ` · inherits ${t.inherited.length}, noted`;
		rows.push({
			key: `node:${t.name}`,
			kind: "node",
			source: compactIri(t.iri),
			name: t.name,
			note,
		});
	}
	for (const t of report.types.filter((t) => t.kind === "edge")) {
		const edge = draft.edge_types.find((e) => e.name === t.name);
		rows.push({
			key: `edge:${t.name}`,
			kind: "edge",
			source: compactIri(t.iri),
			name: t.name,
			note: edge
				? `${edge.source_node_types.join(", ")} → ${edge.target_node_types.join(", ")}`
				: "",
		});
	}
	report.suggestions.forEach((s, i) => {
		rows.push({
			key: `stitch:${i}`,
			kind: "stitch",
			source: `${s.name} · ${SUGGESTION_WORD[s.kind] ?? s.kind} ${compactIri(s.target_iri)}`,
			note: "you confirm it in Stitches",
		});
	});
	report.skipped.forEach((n, i) => {
		rows.push({
			key: `skipped:${i}`,
			kind: "skipped",
			source: n.iri ? compactIri(n.iri) : n.subject,
			note: n.message,
		});
	});
	return rows;
}

/** The chips: `7 types · 9 edges`, and the skipped count. */
export function summaryCounts(report: OntologyReport) {
	return {
		types: `${plural(report.mapped.node_types, "type")} · ${plural(report.mapped.edge_types, "edge")}`,
		skipped: report.skipped_count,
		moreSkipped: Math.max(0, report.skipped_count - report.skipped.length),
		moreNotes: Math.max(0, report.notes_count - report.notes.length),
	};
}

/** `Person, Organization + 4 they need`, or `every class` with none picked. */
export function previewDescription(
	picked: string[],
	report: OntologyReport,
): string {
	if (!picked.length) return "every class";
	const cameWith = report.types.filter(
		(t) => t.kind === "node" && t.came_with,
	).length;
	return cameWith
		? `${picked.join(", ")} + ${cameWith} they need`
		: picked.join(", ");
}
