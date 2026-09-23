/**
 * Govern — the nine routes under `…/govern/*`.
 *
 * A guardrail and a world are one record separated by `kind`, so `list` filters
 * rather than two paths doing it (GV1). Two endpoints would be the second
 * enforcement path the module exists not to have.
 */

import { request } from "@/services/api/client";
import type {
	CastRole,
	CatalogueResponse,
	CompareResponse,
	GovernLayer,
	GovernRule,
	ImpactResponse,
	Lens,
	LensCreate,
	LensKind,
	LensListResponse,
	LensUpdate,
	TouchesResponse,
	ValidationResponse,
} from "@/types/govern";

function base(username: string, graphSlug: string): string {
	return `/api/v1/u/${username}/${graphSlug}/govern`;
}

const post = (path: string, data: unknown) =>
	request(path, { method: "POST", body: JSON.stringify(data) });

function query(params: Record<string, string | boolean | undefined>): string {
	const qs = new URLSearchParams();
	for (const [k, v] of Object.entries(params)) {
		if (v !== undefined && v !== "") qs.set(k, String(v));
	}
	const s = qs.toString();
	return s ? `?${s}` : "";
}

export const governApi = {
	// ── Lenses — worlds and guardrails, one record ──────────────────────────
	/**
	 * `kind` filters; omitted returns both. `includeUnnamed` brings in the
	 * lenses attached to a run and private to whoever ran it — off by default,
	 * because naming is what puts one in the Graph's Worlds list (GV2).
	 */
	listLenses: (
		u: string,
		g: string,
		opts: { kind?: LensKind; includeUnnamed?: boolean } = {},
	) =>
		request<LensListResponse>(
			`${base(u, g)}/lenses${query({
				kind: opts.kind,
				include_unnamed: opts.includeUnnamed,
			})}`,
		),

	getLens: (u: string, g: string, id: string) =>
		request<Lens>(`${base(u, g)}/lenses/${id}`),

	createLens: (u: string, g: string, data: LensCreate) =>
		post(`${base(u, g)}/lenses`, data) as Promise<Lens>,

	/** Naming an unnamed lens publishes it — the first naming only (GV19). */
	updateLens: (u: string, g: string, id: string, data: LensUpdate) =>
		request<Lens>(`${base(u, g)}/lenses/${id}`, {
			method: "PATCH",
			body: JSON.stringify(data),
		}),

	deleteLens: (u: string, g: string, id: string) =>
		request<void>(`${base(u, g)}/lenses/${id}`, { method: "DELETE" }),

	/** World → guardrail. One field, never a re-authoring (GV3). */
	promoteLens: (u: string, g: string, id: string, scope = "graph") =>
		post(`${base(u, g)}/lenses/${id}/promote`, { scope }) as Promise<Lens>,

	duplicateLens: (u: string, g: string, id: string) =>
		post(`${base(u, g)}/lenses/${id}/duplicate`, {}) as Promise<Lens>,

	/** What a save would be refused for, before the save (WO3). */
	validateLens: (
		u: string,
		g: string,
		data: {
			rules?: GovernRule[];
			cast?: Partial<Record<CastRole, string>>;
			closed_layers?: GovernLayer[];
		},
	) =>
		post(`${base(u, g)}/lenses/validate`, data) as Promise<ValidationResponse>,

	/** What a guardrail save would cost every world that narrows inside it. */
	guardrailImpact: (
		u: string,
		g: string,
		data: {
			rules?: GovernRule[];
			closed_layers?: GovernLayer[];
			scope?: string;
		},
	) => post(`${base(u, g)}/lenses/impact`, data) as Promise<ImpactResponse>,

	// ── The catalogue — resolved, never stored (GV21) ────────────────────────
	/**
	 * What this Graph can address; with `match`, what a rule would bite right
	 * now. The rule builder reads this as the pattern is typed, which is what
	 * makes *narrowing is picking, not writing* enforceable (WO7).
	 */
	participants: (
		u: string,
		g: string,
		opts: { layer?: GovernLayer; match?: string } = {},
	) =>
		request<CatalogueResponse>(
			`${base(u, g)}/participants${query({
				layer: opts.layer,
				match: opts.match,
			})}`,
		),

	// ── What a run actually did ──────────────────────────────────────────────
	touches: (u: string, g: string, runId: string) =>
		request<TouchesResponse>(`${base(u, g)}/runs/${runId}/touches`),

	compare: (u: string, g: string, a: string, b: string) =>
		request<CompareResponse>(`${base(u, g)}/compare${query({ a, b })}`),
};
