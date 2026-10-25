// ─────────────────────────────────────────────────────────────────────────────
// Emissions (docs/for-developers/modules/ask/features/the-answer-surface.md).
//
// An emission is one thing a step produced — a subgraph, table, metric, chart,
// prose block, or the empty answer. An answer is its emissions, in order.
//
// It is *not* a ask frame: a frame is how anything travels over the stream
// (`step.started`, `diagnosis`, an emission arriving), an emission is the part
// a reader sees (docs/for-developers/terminology.md · Ask).
// ─────────────────────────────────────────────────────────────────────────────

import type { GraphData } from "./query";

export type EmissionKind =
	| "subgraph"
	| "table"
	| "metric"
	| "chart"
	| "prose"
	| "empty"
	| "link";

/** The projection template that chose the rendering, when one did. */
interface EmissionTemplate {
	id?: string;
	name: string;
	version: number;
}

/**
 * A template the reader could switch to.
 *
 * One that cannot render this shape is offered **disabled with its reason**
 * rather than hidden (projections.md) — otherwise a reader is left wondering
 * where the chart went.
 */
export interface TemplateOffer {
	templateId: string;
	name: string;
	surface: string;
	version: number;
	available: boolean;
	reason: string | null;
}

/** What the emission was produced from — the query, and how many records. */
interface EmissionCitation {
	recordCount: number;
	queryId?: string;
	/** The query itself, verbatim and copyable. */
	query?: string;
	queryLanguage?: string;
	executionTimeMs?: number;
}

export interface TableEmission {
	kind: "table";
	rows: Record<string, unknown>[];
}

export interface SubgraphEmission {
	kind: "subgraph";
	data: GraphData;
	/** A subgraph adds to the canvas; it never replaces it. */
	onCanvas: boolean;
}

export interface MetricEmission {
	kind: "metric";
	value: string;
	label?: string;
	/** One line under the value — "Nifty +1.1% over the same window". */
	comparison?: string;
}

export interface ChartEmission {
	kind: "chart";
	caption?: string;
	series: { label: string; value: number; display?: string }[];
}

export interface ProseEmission {
	kind: "prose";
	text: string;
	/** Markers in `text` resolve to these records, in order. */
	citations?: string[];
}

/** Zero records, worded as an answer rather than drawn as a blank table. */
export interface EmptyEmission {
	kind: "empty";
	statement: string;
}

/** One filter a link sets, as the list's strip reads it. */
interface LinkChip {
	field: string;
	title: string;
	value: string;
	label: string;
}

/** A filter the engine could not resolve, in the words that failed. */
interface LinkUnresolved {
	field: string;
	word: string;
	reason: string;
}

/**
 * An ask for a list, answered by opening it
 * (docs/for-developers/modules/ask/features/the-assistant-opens-boards.md):
 * the list, its filters as the list contract's own params, one chip per
 * filter and the row count the list's own query returned.
 */
export interface LinkEmission {
	kind: "link";
	/** `runs` · `agents` · `approvals` · `ledger`. */
	list: string;
	/** The list's name — `Runs`. */
	label: string;
	/** What one row is called, singular then plural. */
	noun: [string, string];
	/** Where the list lives under the Graph — `/agents/runs`. */
	path: string;
	/** `f.<field>` → value, exactly what a person would set. */
	params: Record<string, string>;
	chips: LinkChip[];
	total: number;
	unresolved: LinkUnresolved[];
}

type EmissionBody =
	| TableEmission
	| SubgraphEmission
	| MetricEmission
	| ChartEmission
	| ProseEmission
	| EmptyEmission
	| LinkEmission;

export type Emission = EmissionBody & {
	/** The row's id, once the engine has written it. Absent for a derived one. */
	id?: string;
	/** Order within the answer. */
	seq: number;
	template?: EmissionTemplate;
	citation: EmissionCitation;
	/** What else would render these same records, and why the rest cannot. */
	templates?: TemplateOffer[];
};
