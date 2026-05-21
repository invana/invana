/**
 * Audit events API client (RFC-018).
 *
 * Two endpoint families:
 * - `/api/v1/events` — global, superuser only.
 * - `/api/v1/u/:username/:graphSlug/events` — per-graph, any member.
 *
 * Each has a paginated read + an SSE `/stream` companion. The SSE side is
 * wired in `useEventStream` (browser EventSource); this client handles the
 * paginated reads.
 */

import type { EventListFilters, EventListResponse } from "../../types/events";
import { apiClient } from "./client";

function buildParams(filters: EventListFilters | undefined): URLSearchParams {
	const params = new URLSearchParams();
	if (!filters) return params;
	if (filters.cursor) params.set("cursor", filters.cursor);
	if (filters.page_size) params.set("page_size", String(filters.page_size));
	if (filters.graph_id) params.set("graph_id", filters.graph_id);
	if (filters.actor_id) params.set("actor_id", filters.actor_id);
	if (filters.action_prefix) params.set("action_prefix", filters.action_prefix);
	if (filters.since) params.set("since", filters.since);
	if (filters.until) params.set("until", filters.until);
	return params;
}

export const eventsApi = {
	/** Per-graph paginated list. */
	async listForGraph(
		username: string,
		graphSlug: string,
		filters?: EventListFilters,
	): Promise<EventListResponse> {
		const params = buildParams(filters);
		const qs = params.toString();
		const res = await apiClient.get<EventListResponse>(
			`/api/v1/u/${username}/${graphSlug}/events${qs ? `?${qs}` : ""}`,
		);
		return res.data;
	},

	/** Global (superuser-only) paginated list. */
	async listGlobal(filters?: EventListFilters): Promise<EventListResponse> {
		const params = buildParams(filters);
		const qs = params.toString();
		const res = await apiClient.get<EventListResponse>(
			`/api/v1/events${qs ? `?${qs}` : ""}`,
		);
		return res.data;
	},

	/**
	 * Stream-endpoint URLs. The actual SSE subscription is opened from the
	 * `useEventStream` hook via the native `EventSource`; we return the URLs
	 * here so the hook stays free of `BASE_URL` knowledge.
	 */
	streamUrls: {
		forGraph(username: string, graphSlug: string): string {
			return `/api/v1/u/${username}/${graphSlug}/events/stream`;
		},
		global(): string {
			return "/api/v1/events/stream";
		},
	},
};
