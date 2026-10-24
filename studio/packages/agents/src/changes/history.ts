/**
 * A record's change log (`/history/<kind>/<id>`) as the agent and skill pages
 * read it: every change with who made it, why, and what happened after.
 * Mirrors the engine's `RecordHistory`; the shared compare board is the
 * shell's, so only what these pages draw is typed here.
 */

import { request } from "@invana-studio/core";
import { useQuery } from "@tanstack/react-query";

export type RecordKind = "skill" | "agent" | "plan";

export interface ChangeEffect {
	/** `pinned` — runs that recorded this version; `window` — until the next change. */
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
}

export interface ChangeEntry {
	event_id: string | null;
	version: string;
	version_id: string | null;
	at: string | null;
	action: string | null;
	actor_kind: string | null;
	actor_id: string | null;
	actor_name: string | null;
	summary: string;
	why: string | null;
	effect: ChangeEffect;
}

export interface RecordHistory {
	record_kind: RecordKind;
	record_id: string;
	name: string;
	items: ChangeEntry[];
}

const base = (u: string, g: string, kind: RecordKind, id: string) =>
	`/api/v1/u/${u}/${g}/history/${kind}/${id}`;

export function useRecordHistoryQuery(
	username: string,
	graphSlug: string,
	kind: RecordKind,
	id: string,
) {
	return useQuery({
		queryKey: ["history", username, graphSlug, kind, id],
		queryFn: () => request<RecordHistory>(base(username, graphSlug, kind, id)),
	});
}

/** `212 runs · 3 failed · 41k tokens` — or what an empty window means. */
export function effectLine(e: ChangeEffect): string {
	if (e.runs === 0) return "no runs yet";
	const tokens = e.tokens;
	const t =
		tokens >= 10_000
			? `${Math.round(tokens / 1000)}k`
			: tokens.toLocaleString();
	return `${e.runs} run${e.runs === 1 ? "" : "s"} · ${e.failed} failed · ${t} tokens`;
}
