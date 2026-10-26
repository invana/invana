/**
 * The change log's reads, as every product draws them
 * (docs/for-developers/modules/operate/features/change-log.md).
 *
 * Three engine routes, one shape whatever the record:
 *
 * | Read | Route |
 * |---|---|
 * | The change log | `GET …/events?changes=true` (the Events tab's Changes filter) |
 * | A record's versions | `GET …/history/<kind>/<id>` — {@link useRecordHistoryQuery} |
 * | Two of them | `GET …/history/<kind>/<id>/compare?a=&b=` — {@link useCompareQuery} |
 *
 * A change event names its target by the engine's `target_kind`;
 * {@link changeOf} turns one into the record the history routes read, and the
 * product that record lives in. A plan's record is its **key**, which the event
 * carries in `details.key` — its `target_id` is one plan row.
 *
 * Effect after is counted on the engine and only ever drawn in tokens.
 */

import type { Change, ProductId } from "@invana-studio/core";
import { request } from "@invana-studio/core";
import { useQueries, useQuery } from "@tanstack/react-query";
import type { AuditEvent } from "../events/types";

export const RECORD_KINDS = [
	"skill",
	"rule",
	"plan",
	"agent",
	"model",
] as const;
export type RecordKind = (typeof RECORD_KINDS)[number];

export interface ChangeEffect {
	/** `pinned` — runs that recorded this version; `window` — while it was published. */
	basis: "pinned" | "window" | "bound";
	runs: number;
	failed: number;
	tokens_in: number;
	tokens_out: number;
	/** The engine's `in + out`, and that over `runs` — null when nothing ran. */
	tokens: number;
	tokens_per_run: number | null;
	since: string | null;
	until: string | null;
	/** A model version's: the bound datasets its publish touched, stored at publish. */
	datasets?: EffectDataset[];
	datasets_failing?: number;
	rows_failing?: number;
}

/** A dataset bound to a type a model version's publish changed. */
interface EffectDataset {
	dataset_id: string;
	/** `publisher/name`. */
	name: string;
	version: number;
	type: string;
	/** Rows the publish's scan found failing on that type; 0 when additive. */
	rows_failing: number;
}

export interface ChangeEntry {
	version: string;
	version_id: string | null;
	at: string | null;
	action: string | null;
	event_id: string | null;
	actor_id: string | null;
	actor_kind: string | null;
	actor_name: string | null;
	why: string | null;
	/** One line against the version before. */
	summary: string;
	effect: ChangeEffect;
}

export interface RecordHistory {
	record_kind: RecordKind;
	record_id: string;
	name: string;
	/** Newest first. */
	items: ChangeEntry[];
}

export interface ChangeField {
	field: string;
	before: unknown;
	after: unknown;
	/** A unified diff, for text fields. */
	lines: string[];
}

interface PlanDiff {
	added: string[];
	removed: string[];
	moved: string[];
	changed: { step_key: string; fields: string[] }[];
	summary: string;
}

interface Named {
	name: string;
}

/** The engine's model diff — the lists Studio draws. */
export interface SchemaDiff {
	added_node_types: string[];
	removed_node_types: string[];
	modified_node_types: Named[];
	added_edge_types: string[];
	removed_edge_types: string[];
	modified_edge_types: Named[];
	added_property_keys: string[];
	removed_property_keys: string[];
	added_constraints: string[];
	removed_constraints: string[];
	added_indexes: string[];
	removed_indexes: string[];
	classification: "major" | "minor" | "patch";
}

export interface ChangeCompare {
	record_kind: RecordKind;
	record_id: string;
	/** Null when `b` is the first version — compared against nothing. */
	a: string | null;
	b: string;
	summary: string;
	fields: ChangeField[];
	plan: PlanDiff | null;
	schema_diff: SchemaDiff | null;
	/** Tokens per run on `b` against `a`; null when either ran nothing. */
	tokens_per_run_change: Change | null;
}

interface GraphRef {
	username: string;
	graphSlug: string;
}

const base = (g: GraphRef, kind: RecordKind, id: string) =>
	`/api/v1/u/${g.username}/${g.graphSlug}/history/${kind}/${encodeURIComponent(id)}`;

/** One record's history in the query cache — the compare crumb reads its name. */
export const historyKey = (g: GraphRef, kind: RecordKind, id: string) => [
	"history",
	g.username,
	g.graphSlug,
	kind,
	id,
];

/** Every version of one record, newest first. */
export function useRecordHistoryQuery(
	graph: GraphRef,
	kind: RecordKind,
	id: string | null,
) {
	return useQuery({
		queryKey: historyKey(graph, kind, id ?? ""),
		queryFn: () => request<RecordHistory>(base(graph, kind, id as string)),
		enabled: !!id,
	});
}

/** Several records' histories in one read — a change log page, every model. */
export function useRecordHistories(
	graph: GraphRef,
	records: { kind: RecordKind; id: string }[],
) {
	return useQueries({
		queries: records.map((r) => ({
			queryKey: historyKey(graph, r.kind, r.id),
			queryFn: () => request<RecordHistory>(base(graph, r.kind, r.id)),
			retry: false,
		})),
	});
}

/** Two versions; `a` empty compares `b` with the one before it. */
export function useCompareQuery(
	graph: GraphRef,
	kind: RecordKind,
	id: string,
	b: string | null,
	a?: string | null,
) {
	return useQuery({
		queryKey: [...historyKey(graph, kind, id), "compare", a ?? null, b],
		queryFn: () => {
			const q = new URLSearchParams({ b: b as string });
			if (a) q.set("a", a);
			return request<ChangeCompare>(`${base(graph, kind, id)}/compare?${q}`);
		},
		enabled: !!b,
	});
}

/** `212 runs · 3 failed · 41k tokens` — or what an empty span means. */
export function effectLine(e: ChangeEffect): string {
	if (e.runs === 0) return e.until ? "no runs" : "no runs yet";
	const tokens = e.tokens;
	const t =
		tokens >= 10_000
			? `${Math.round(tokens / 1000)}k`
			: tokens.toLocaleString();
	return `${e.runs} run${e.runs === 1 ? "" : "s"} · ${e.failed} failed · ${t} tokens`;
}

/** Tokens per run on a version, or null when nothing ran. */
export function tokensPerRun(e: ChangeEffect): number | null {
	return e.tokens_per_run;
}

/** The event `target_kind` each record kind's changes carry. */
const BY_TARGET: Record<string, RecordKind> = {
	skill: "skill",
	rule: "rule",
	flow: "plan",
	agent: "agent",
	graph_model: "model",
};

/** The product a record lives in — the badge on its change row. */
export const PRODUCT_OF: Record<RecordKind, ProductId> = {
	skill: "agents",
	agent: "agents",
	plan: "agents",
	rule: "modeller",
	model: "modeller",
};

export interface ChangeRef {
	kind: RecordKind;
	/** What the history routes read: a plan's key, every other record's id. */
	id: string;
	/** The version the event minted; null when the event predates the label. */
	version: string | null;
}

/**
 * What the event called its record when it was written — the only name a
 * record has once it is deleted. Agents and skills carry `name`, a rule its
 * `statement`, a plan its `key`; a model carries none and reads as its kind.
 */
export function snapshotName(event: AuditEvent, kind: RecordKind): string {
	const d = event.details ?? {};
	for (const field of ["name", "statement", "key"]) {
		const v = d[field];
		if (typeof v === "string" && v) return v;
	}
	return `Unnamed ${kind}`;
}

const VERBS: Record<string, string> = {
	create: "created",
	update: "updated",
	publish: "published",
	activate: "published",
	commit: "published",
	promote: "promoted",
	soul_set: "soul changed",
};

/** `agent.update` → *updated*: the line a change reads when its history is gone. */
export function changeVerb(action: string): string {
	return VERBS[action.slice(action.lastIndexOf(".") + 1)] ?? "changed";
}

/** The record a version-minting event changed, or null for any other event. */
export function changeOf(event: AuditEvent): ChangeRef | null {
	const kind = event.target_kind ? BY_TARGET[event.target_kind] : undefined;
	if (!kind) return null;
	const d = event.details ?? {};
	const id = kind === "plan" ? d.key : event.target_id;
	if (typeof id !== "string" || !id) return null;
	const created = event.action.endsWith(".create");
	const v = d.version;
	const version = v != null && v !== "" ? String(v) : created ? "1" : null;
	return { kind, id, version };
}
