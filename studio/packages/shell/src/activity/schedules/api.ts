/**
 * Schedules API client — `/api/v1/u/:username/:graphSlug/schedules`
 * (docs/for-developers/modules/operate/features/schedules.md).
 *
 * *Run now* answers `202` with a `queued` firing: the engine's clock opens
 * the run after the request commits, so the firing's run appears on a refetch.
 */

import {
	apiClient,
	type GraphRef,
	type ListQuery,
	listQueryToApi,
} from "@invana-studio/core";
import type {
	Firing,
	FiringListResponse,
	Schedule,
	SchedulePage,
	ScheduleUpdate,
	ScheduleWrite,
} from "./types";

const base = (g: GraphRef) =>
	`/api/v1/u/${g.username}/${g.graphSlug}/schedules`;

export const schedulesApi = {
	/** `q` searches the name; `enabled` and `agent_id` filter; sorted by name. */
	async list(g: GraphRef, query: ListQuery = {}): Promise<SchedulePage> {
		return (
			await apiClient.get<SchedulePage>(`${base(g)}${listQueryToApi(query)}`)
		).data;
	},
	async get(g: GraphRef, id: string): Promise<Schedule> {
		return (await apiClient.get<Schedule>(`${base(g)}/${id}`)).data;
	},
	async create(g: GraphRef, body: ScheduleWrite): Promise<Schedule> {
		return (await apiClient.post<Schedule>(base(g), body)).data;
	},
	async update(
		g: GraphRef,
		id: string,
		body: ScheduleUpdate,
	): Promise<Schedule> {
		return (await apiClient.patch<Schedule>(`${base(g)}/${id}`, body)).data;
	},
	async remove(g: GraphRef, id: string): Promise<void> {
		await apiClient.delete(`${base(g)}/${id}`);
	},
	async pause(g: GraphRef, id: string): Promise<Schedule> {
		return (await apiClient.post<Schedule>(`${base(g)}/${id}/pause`)).data;
	},
	async resume(g: GraphRef, id: string): Promise<Schedule> {
		return (await apiClient.post<Schedule>(`${base(g)}/${id}/resume`)).data;
	},
	async runNow(g: GraphRef, id: string): Promise<Firing> {
		return (await apiClient.post<Firing>(`${base(g)}/${id}/run`)).data;
	},
	async firings(
		g: GraphRef,
		id: string,
		limit = 50,
	): Promise<FiringListResponse> {
		return (
			await apiClient.get<FiringListResponse>(
				`${base(g)}/${id}/firings?limit=${limit}`,
			)
		).data;
	},
};
