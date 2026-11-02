/**
 * TanStack Query hooks for a function's page, keyed
 * `["functions", owner, graph, …]` because who names it and how its calls went
 * are the Graph's. The plugin registry's hooks are core's.
 */

import { type ListQuery, listQueryKey } from "@invana-studio/core";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { functionsApi } from "./api";

const functionKey = (username: string, graphSlug: string, key: string) =>
	["functions", username, graphSlug, key] as const;

/** One function's page in a Graph: contract, plans and skills naming it, calls over 30 days. */
export function useFunctionQuery(
	username: string | undefined,
	graphSlug: string | undefined,
	key: string,
) {
	return useQuery({
		queryKey: functionKey(username ?? "", graphSlug ?? "", key),
		queryFn: () => functionsApi.get(username ?? "", graphSlug ?? "", key),
		enabled: !!username && !!graphSlug && !!key,
	});
}

/** One page of the run steps that called a function, newest first. */
export function useFunctionCallsQuery(
	username: string,
	graphSlug: string,
	key: string,
	query: ListQuery = {},
) {
	return useQuery({
		queryKey: [
			...functionKey(username, graphSlug, key),
			"calls",
			listQueryKey(query),
		],
		queryFn: () => functionsApi.calls(username, graphSlug, key, query),
		placeholderData: keepPreviousData,
	});
}
