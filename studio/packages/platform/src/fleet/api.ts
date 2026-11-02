import {
	type ListQuery,
	listQueryToApi,
	type Page,
	request,
} from "@invana-studio/core";
import type {
	Capacity,
	JoinStatus,
	JoinTokenCreated,
	JoinTokenIn,
	JoinTokenRow,
	PoolIn,
	PoolRow,
	PoolsOverview,
	WorkerDetail,
	WorkerEventRow,
	WorkerListPage,
} from "./types";

const base = "/api/v1/workers";
// A pool or worker is addressed by id or name; a name is URL-encoded.
const ref = (r: string) => encodeURIComponent(r);

/** Workers and pools are install-wide: no Graph in any path. */
export const workersApi = {
	overview: () => request<PoolsOverview>(`${base}/overview`),

	pools: (query: ListQuery = {}) =>
		request<Page<PoolRow>>(`${base}/pools${listQueryToApi(query)}`),

	pool: (pool: string) => request<PoolRow>(`${base}/pools/${ref(pool)}`),

	createPool: (body: PoolIn) =>
		request<PoolRow>(`${base}/pools`, {
			method: "POST",
			body: JSON.stringify(body),
		}),

	drainPool: (pool: string) =>
		request<void>(`${base}/pools/${ref(pool)}/drain`, { method: "POST" }),

	workers: (query: ListQuery = {}) =>
		request<WorkerListPage>(`${base}/workers${listQueryToApi(query)}`),

	worker: (worker: string) =>
		request<WorkerDetail>(`${base}/workers/${ref(worker)}`),

	drainWorker: (worker: string) =>
		request<void>(`${base}/workers/${ref(worker)}/drain`, { method: "POST" }),

	capacity: () => request<Capacity>(`${base}/capacity`),

	events: (query: ListQuery = {}) =>
		request<Page<WorkerEventRow>>(`${base}/events${listQueryToApi(query)}`),

	tokens: (query: ListQuery = {}) =>
		request<Page<JoinTokenRow>>(`${base}/join-tokens${listQueryToApi(query)}`),

	createToken: (body: JoinTokenIn) =>
		request<JoinTokenCreated>(`${base}/join-tokens`, {
			method: "POST",
			body: JSON.stringify(body),
		}),

	revokeToken: (id: string) =>
		request<void>(`${base}/join-tokens/${ref(id)}`, { method: "DELETE" }),

	joinStatus: (id: string) =>
		request<JoinStatus>(`${base}/join-tokens/${ref(id)}/status`),
};
