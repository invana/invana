/**
 * The Graph's lens list — worlds and guardrails, one record told apart by
 * `kind`. Read by the Modeller, which authors them, and by the products that
 * show which bounds hold (an agent's guardrails, the assistant's worlds).
 * Writing a lens stays with the Modeller.
 */

import type { LensKind, LensListResponse } from "../../types/lenses";
import { request } from "./client";

function query(params: Record<string, string | boolean | undefined>): string {
	const qs = new URLSearchParams();
	for (const [k, v] of Object.entries(params)) {
		if (v !== undefined && v !== "") qs.set(k, String(v));
	}
	const s = qs.toString();
	return s ? `?${s}` : "";
}

export const lensesApi = {
	/**
	 * `kind` filters; omitted returns both. `includeUnnamed` brings in the
	 * lenses attached to a run and private to whoever ran it — off by default,
	 * because naming is what puts one in the Graph's Worlds list.
	 */
	list: (
		username: string,
		graphSlug: string,
		opts: { kind?: LensKind; includeUnnamed?: boolean } = {},
	) =>
		request<LensListResponse>(
			`/api/v1/u/${username}/${graphSlug}/govern/lenses${query({
				kind: opts.kind,
				include_unnamed: opts.includeUnnamed,
			})}`,
		),
};
