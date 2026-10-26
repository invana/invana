/**
 * Requests queries. The rail badge and the page read the same open count —
 * `RequestPage.open` — so a resolve refreshes both through one key.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type RequestListParams, requestsApi } from "./api";
import type { RequestResolve } from "./types";

const requestsKey = (u: string, g: string) => ["requests", u, g] as const;

export function useRequestsQuery(
	username?: string,
	graphSlug?: string,
	params: RequestListParams = {},
) {
	return useQuery({
		queryKey: [...requestsKey(username ?? "", graphSlug ?? ""), params],
		queryFn: () =>
			requestsApi.list(username as string, graphSlug as string, params),
		enabled: !!username && !!graphSlug,
	});
}

export function useRequestQuery(
	username?: string,
	graphSlug?: string,
	requestId?: string | null,
) {
	return useQuery({
		queryKey: [...requestsKey(username ?? "", graphSlug ?? ""), requestId],
		queryFn: () =>
			requestsApi.get(
				username as string,
				graphSlug as string,
				requestId as string,
			),
		enabled: !!username && !!graphSlug && !!requestId,
	});
}

/** The open count alone — what the rail badge reads. */
export function useOpenRequestsCount(username?: string, graphSlug?: string) {
	return useRequestsQuery(username, graphSlug, { status: "open", limit: 1 })
		.data?.open;
}

/**
 * Resolve a request. Allowing it edits a guardrail and modelling it creates a
 * draft, so the govern and model caches are refreshed with the list.
 */
export function useResolveRequestMutation(
	username?: string,
	graphSlug?: string,
) {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: ({ id, data }: { id: string; data: RequestResolve }) =>
			requestsApi.resolve(username as string, graphSlug as string, id, data),
		onSettled: () => {
			qc.invalidateQueries({
				queryKey: requestsKey(username ?? "", graphSlug ?? ""),
			});
			qc.invalidateQueries({
				queryKey: ["govern", username ?? "", graphSlug ?? ""],
			});
		},
	});
}
