/**
 * Govern — the routes under `…/govern/*`.
 *
 * A world is a `lenses` row authored as layered rules; a Graph guardrail is one
 * property rule under `…/guardrails`, stored on the same table with its rules
 * compiled by the engine, so enforcement keeps one path.
 */

import type {
	CastRole,
	CatalogueResponse,
	CompareResponse,
	GovernLayer,
	GovernRule,
	Lens,
	LensCreate,
	LensUpdate,
	TouchesResponse,
	ValidationResponse,
} from "@invana-studio/core";
import { request } from "@invana-studio/core";
import type {
	GuardrailDetail,
	GuardrailImpact,
	GuardrailPage,
	GuardrailRule,
	GuardrailTarget,
	GuardrailUpdate,
	LensView,
} from "./types";

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
	// The list is core's `lensesApi.list`; the reads and writes of one lens
	// are here.
	getLens: (u: string, g: string, id: string) =>
		request<Lens>(`${base(u, g)}/lenses/${id}`),

	createLens: (u: string, g: string, data: LensCreate) =>
		post(`${base(u, g)}/lenses`, data) as Promise<Lens>,

	/** Naming an unnamed lens publishes it — the first naming only. */
	updateLens: (u: string, g: string, id: string, data: LensUpdate) =>
		request<Lens>(`${base(u, g)}/lenses/${id}`, {
			method: "PATCH",
			body: JSON.stringify(data),
		}),

	deleteLens: (u: string, g: string, id: string) =>
		request<void>(`${base(u, g)}/lenses/${id}`, { method: "DELETE" }),

	duplicateLens: (u: string, g: string, id: string) =>
		post(`${base(u, g)}/lenses/${id}/duplicate`, {}) as Promise<Lens>,

	/** What a save would be refused for, before the save. */
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

	// ── Guardrails — one property rule each ─────────────────────────────────
	guardrails: (u: string, g: string) =>
		request<GuardrailPage>(`${base(u, g)}/guardrails`),

	guardrail: (u: string, g: string, id: string) =>
		request<GuardrailDetail>(`${base(u, g)}/guardrails/${id}`),

	/** Every `Type.property` the picker offers, from published versions. */
	guardrailTargets: (u: string, g: string) =>
		request<GuardrailTarget[]>(`${base(u, g)}/guardrails/targets`),

	/** What a guardrail save would cost, counted before the write. */
	guardrailImpact: (u: string, g: string, data: GuardrailRule) =>
		post(`${base(u, g)}/guardrails/impact`, data) as Promise<GuardrailImpact>,

	createGuardrail: (u: string, g: string, data: GuardrailRule) =>
		post(`${base(u, g)}/guardrails`, data) as Promise<GuardrailDetail>,

	updateGuardrail: (u: string, g: string, id: string, data: GuardrailUpdate) =>
		request<GuardrailDetail>(`${base(u, g)}/guardrails/${id}`, {
			method: "PATCH",
			body: JSON.stringify(data),
		}),

	deleteGuardrail: (u: string, g: string, id: string) =>
		request<void>(`${base(u, g)}/guardrails/${id}`, { method: "DELETE" }),

	/** The lens canvas and world inspector — the guardrails alone without a world. */
	view: (u: string, g: string, world?: string) =>
		request<LensView>(`${base(u, g)}/view${query({ world })}`),

	// ── The catalogue — resolved, never stored ────────────────────────
	/**
	 * What this Graph can address; with `match`, what a rule would bite right
	 * now. The rule builder reads this as the pattern is typed, which is what
	 * makes *narrowing is picking, not writing* enforceable.
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
