/**
 * Wire shapes of the datasets, standards and dataset-bindings routes
 * (engine `apps/datasets` and `apps/standards` schemas), as Studio reads them.
 */

import type { ChangeEntry } from "@invana-studio/shell";

export type Origin =
	| "official"
	| "collected"
	| "generated"
	| "observed"
	| "derived";

type Sensitivity = "public" | "internal" | "confidential" | "personal";

export type Visibility = "private" | "install";

export type Enforcement = "block" | "warn" | "report";

export interface AuthorStep {
	role: "original" | "collected_by" | "modified_by" | "validated_by";
	kind: "organisation" | "page" | "person" | "agent" | "run";
	name: string;
	ref?: string | null;
	result?: string | null;
}

interface Retraction {
	at: string;
	by_id: string | null;
	reason: string | null;
}

export interface Dataset {
	id: string;
	address: string;
	publisher: string;
	name: string;
	title: string;
	description: string;
	origin: Origin;
	key_column: string;
	visibility: Visibility;
	sensitivity: Sensitivity;
	column_sensitivity: Record<string, Sensitivity>;
	refresh_schedule: string | null;
	refresh_source: string | null;
	/** The current version's number; null before the first import. */
	current_version: number | null;
	licence: string | null;
	author_chain: AuthorStep[];
	record_count: number;
	content_hash: string | null;
	created_by_id: string | null;
	created_at: string;
	updated_at: string;
	warnings?: string[];
}

export interface DatasetListResponse {
	items: Dataset[];
	total: number;
}

export interface DatasetUpdate {
	title?: string;
	description?: string;
	visibility?: Visibility;
	sensitivity?: Sensitivity;
}

export interface DatasetVersion {
	id: string;
	dataset_id: string;
	address: string;
	version: number;
	content_hash: string;
	licence: string;
	author_chain: AuthorStep[];
	columns: string[];
	record_count: number;
	source: string | null;
	derived_from: string[];
	why: string | null;
	published_by_id: string | null;
	published_at: string;
	retracted: Retraction | null;
	retracted_inputs?: string[];
	warnings?: string[];
}

export interface DatasetVersionListResponse {
	items: DatasetVersion[];
	total: number;
}

export interface DatasetVersionCreate {
	licence: string;
	author_chain?: AuthorStep[];
	/** Every record of the new version; `_provenance` carries a record's exception. */
	records: Record<string, unknown>[];
	source?: string | null;
	derived_from?: string[];
	why?: string | null;
}

export interface DatasetRecord {
	key: string;
	version: number;
	values: Record<string, unknown>;
	/** Set only where the record's origin differs from its dataset's. */
	provenance: Record<string, unknown> | null;
}

export interface DatasetRecordPage {
	address: string;
	items: DatasetRecord[];
	offset: number;
	limit: number;
	total: number;
}

export interface PropertyChange {
	property: string;
	before?: unknown;
	after?: unknown;
}

interface RecordChange {
	version: number;
	at: string;
	actor_id: string | null;
	why: string | null;
	kind: "added" | "changed" | "removed";
	properties: PropertyChange[];
}

export interface RecordChangeLog {
	address: string;
	key: string;
	items: RecordChange[];
}

/** The dataset's versions as the change log reads them, newest first. */
export interface DatasetHistory {
	record_kind: "dataset";
	record_id: string;
	name: string;
	items: ChangeEntry[];
}

export interface DatasetBinding {
	id: string;
	graph_id: string;
	model_id: string;
	model_name: string | null;
	type_name: string;
	address: string;
	version: number;
	run_id: string | null;
	bound_by_id: string | null;
	bound_at: string;
	retracted: Retraction | null;
	newer_version?: number | null;
	warnings?: string[];
}

export interface DatasetBindingListResponse {
	items: DatasetBinding[];
	total: number;
}

interface DatasetVersionRef {
	address: string;
	dataset_id: string;
	version_id: string;
}

export interface DatasetVersionUsage {
	address: string;
	bindings: DatasetBinding[];
	derived: DatasetVersionRef[];
	retracted: Retraction | null;
}

// ── Standards ────────────────────────────────────────────────────────────────

export type TermType = "text" | "integer" | "number" | "boolean" | "date";

interface TermValue {
	code: string;
	label?: string | null;
	iri?: string | null;
	broader?: string | null;
}

export interface StandardTerm {
	name: string;
	type?: TermType;
	required?: boolean;
	values?: TermValue[] | null;
	description?: string | null;
	iri?: string | null;
}

export interface Standard {
	id: string;
	address: string;
	publisher: string;
	name: string;
	title: string;
	description: string;
	origin: "pack" | "authored";
	current_version: number | null;
	terms: StandardTerm[];
	content_hash: string | null;
	created_by_id: string | null;
	created_at: string;
	updated_at: string;
}

export interface StandardListResponse {
	items: Standard[];
	total: number;
}

export interface StandardCreate {
	name: string;
	title?: string;
	description?: string;
	origin?: "pack" | "authored";
	terms?: StandardTerm[];
	why?: string;
}

// ── SKOS import (skos-import.md) ─────────────────────────────────────────────

type RdfFormat = "turtle" | "json-ld" | "rdf-xml";

/** One thing an import skipped, or did in a way worth saying. */
interface ImportNote {
	iri?: string | null;
	subject: string;
	/** `duplicate_code` · `no_label` · `related` … */
	kind: string;
	message: string;
}

interface SkosReport {
	format: RdfFormat;
	triples: number;
	/** `{ terms: 3, values: 41 }` */
	mapped: { terms?: number; values?: number };
	skipped: ImportNote[];
	skipped_count: number;
	notes: ImportNote[];
	notes_count: number;
}

export interface SkosImportRequest {
	content: string;
	format?: RdfFormat;
	/** The concept scheme's IRI; needed when the file holds several. */
	scheme?: string;
	publisher?: string;
	name?: string;
	lang?: string;
	why?: string;
	dry_run?: boolean;
}

export interface SkosImportResult {
	/** `publisher/name` the import writes to — or would. */
	address: string;
	scheme_iri: string | null;
	title: string;
	terms: StandardTerm[];
	/** Absent on a dry run. */
	standard?: Standard | null;
	/** Absent on a dry run, and when the terms were unchanged. */
	version?: { version: number; address: string } | null;
	unchanged: boolean;
	report: SkosReport;
}

export interface Violation {
	key: string;
	term: string;
	kind: "missing" | "not_allowed" | "wrong_type";
	value?: unknown;
}

interface Conformance {
	dataset: string;
	standard: string;
	mode: Enforcement;
	record_count: number;
	conforming: number;
	score: number;
	conforms: boolean;
	violation_count: number;
	violations: Violation[];
	checked_at: string;
}

export interface DatasetStandard {
	/** `publisher/name@v` — the pinned standard version. */
	standard: string;
	version: number;
	newer_version?: number | null;
	mode: Enforcement;
	/** `term → column`. */
	mapping: Record<string, string>;
	attached_by_id: string | null;
	attached_at: string;
	/** The current dataset version's conformance; absent before the first version. */
	conformance?: Conformance | null;
}

export interface DatasetStandardListResponse {
	items: DatasetStandard[];
	total: number;
}

export interface DatasetStandardCreate {
	standard: string;
	mode: Enforcement;
	mapping?: Record<string, string>;
}

// ── A Graph's models, as the bind reads them ─────────────────────────────────

export interface ModelSummary {
	id: string;
	name: string;
	active_version: { id: string; version: string | null } | null;
}

export interface ModelVersionTypes {
	node_types: {
		name: string;
		is_abstract: boolean;
		effective_property_mappings: { property_key: { name: string } }[];
	}[];
}
