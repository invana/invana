/**
 * TanStack Query hooks for Workers. Every key starts `["workers"]`, so any
 * act (drain, revoke, a new pool or token) re-reads the pages together. The
 * Pools and Capacity reads poll every 5 s while mounted.
 */

import type { ListQuery } from "@invana-studio/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { workersApi } from "./api";
import type { JoinTokenIn, PoolIn } from "./types";

const ROOT = ["workers"] as const;
const POLL = 5000;
/** The Joined step's checks land one by one. */
const JOIN_POLL = 2000;
const EVERY: ListQuery = { limit: 200 };

export const useOverviewQuery = () =>
	useQuery({
		queryKey: [...ROOT, "overview"],
		queryFn: workersApi.overview,
		refetchInterval: POLL,
	});

export const usePoolsQuery = () =>
	useQuery({
		queryKey: [...ROOT, "pools"],
		queryFn: () => workersApi.pools(EVERY),
		refetchInterval: POLL,
	});

export const usePoolQuery = (pool: string) =>
	useQuery({
		queryKey: [...ROOT, "pool", pool],
		queryFn: () => workersApi.pool(pool),
		refetchInterval: POLL,
	});

/** `state` narrows to one state chip; `pool` is a pool id. */
export const useWorkersQuery = (filters: { pool?: string; state?: string }) => {
	const f: Record<string, string[]> = {};
	if (filters.pool) f.pool_id = [filters.pool];
	if (filters.state) f.state = [filters.state];
	return useQuery({
		queryKey: [...ROOT, "workers", filters],
		queryFn: () => workersApi.workers({ ...EVERY, filters: f }),
		refetchInterval: POLL,
		// Only a pool id once it is known; the pool page waits for it.
		enabled: filters.pool !== "",
	});
};

export const useWorkerQuery = (worker: string) =>
	useQuery({
		queryKey: [...ROOT, "worker", worker],
		queryFn: () => workersApi.worker(worker),
		refetchInterval: POLL,
	});

export const useCapacityQuery = () =>
	useQuery({
		queryKey: [...ROOT, "capacity"],
		queryFn: workersApi.capacity,
		refetchInterval: POLL,
	});

/** The newest events; `pool` (an id) narrows to one pool's. */
export const useEventsQuery = (limit = 10, pool?: string) =>
	useQuery({
		queryKey: [...ROOT, "events", limit, pool ?? null],
		queryFn: () =>
			workersApi.events(
				pool ? { limit, filters: { pool_id: [pool] } } : { limit },
			),
		refetchInterval: POLL,
	});

/** Every join token, newest first; `pool` (an id) narrows to one pool's. */
export const useTokensQuery = (pool?: string | null) =>
	useQuery({
		queryKey: [...ROOT, "tokens", pool ?? null],
		queryFn: () =>
			workersApi.tokens(
				pool ? { ...EVERY, filters: { pool_id: [pool] } } : EVERY,
			),
		enabled: pool !== null,
	});

/** A pool's newest `limit` workers — the ones a join token just brought in. */
export const useNewestWorkersQuery = (pool: string, limit: number) =>
	useQuery({
		queryKey: [...ROOT, "workers", "newest", pool, limit],
		queryFn: () =>
			workersApi.workers({
				limit,
				sort: "-joined_at",
				filters: { pool_id: [pool] },
			}),
		refetchInterval: POLL,
		enabled: limit > 0,
	});

/** The Joined step: every 2 s until a worker has joined. */
export const useJoinStatusQuery = (tokenId: string | null) =>
	useQuery({
		queryKey: [...ROOT, "join-status", tokenId],
		queryFn: () => workersApi.joinStatus(tokenId as string),
		enabled: tokenId != null,
		refetchInterval: (q) => (q.state.data?.worker_id ? false : JOIN_POLL),
	});

function useActing<V, R>(fn: (v: V) => Promise<R>) {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: fn,
		onSuccess: () => qc.invalidateQueries({ queryKey: ROOT }),
	});
}

export const useDrainPoolMutation = () =>
	useActing((pool: string) => workersApi.drainPool(pool));

export const useDrainWorkerMutation = () =>
	useActing((worker: string) => workersApi.drainWorker(worker));

export const useRevokeTokenMutation = () =>
	useActing((id: string) => workersApi.revokeToken(id));

export const useCreatePoolMutation = () =>
	useActing((body: PoolIn) => workersApi.createPool(body));

export const useCreateTokenMutation = () =>
	useActing((body: JoinTokenIn) => workersApi.createToken(body));
