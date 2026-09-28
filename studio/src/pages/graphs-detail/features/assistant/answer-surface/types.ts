// ─────────────────────────────────────────────────────────────────────────────
// Emissions (docs/for-developers/modules/ask/features/the-answer-surface.md).
//
// An emission is one thing a step produced — a subgraph, table, metric, chart,
// prose block, or the empty answer. An answer is its emissions, in order.
//
// It is *not* a ask frame: a frame is how anything travels over the stream
// (`step.started`, `diagnosis`, an emission arriving), an emission is the part
// a reader sees (docs/for-developers/terminology.md · Ask K9).
// ─────────────────────────────────────────────────────────────────────────────

import type { GraphData } from "@/types/query";

export type EmissionKind =
	| "subgraph"
	| "table"
	| "metric"
	| "chart"
	| "prose"
	| "empty";

/** The projection template that chose the rendering, when one did (AS9). */
export interface EmissionTemplate {
	id?: string;
	name: string;
	version: number;
}

/**
 * A template the reader could switch to.
 *
 * One that cannot render this shape is offered **disabled with its reason**
 * rather than hidden (projections.md P10) — otherwise a reader is left wondering
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
export interface EmissionCitation {
	recordCount: number;
	queryId?: string;
	/** The query itself, verbatim and copyable (RT2). */
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
	/** A subgraph adds to the canvas; it never replaces it (AS5). */
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
	/** Markers in `text` resolve to these records, in order (AS4). */
	citations?: string[];
}

/** Zero records, worded as an answer rather than drawn as a blank table (AS7). */
export interface EmptyEmission {
	kind: "empty";
	statement: string;
}

export type EmissionBody =
	| TableEmission
	| SubgraphEmission
	| MetricEmission
	| ChartEmission
	| ProseEmission
	| EmptyEmission;

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
