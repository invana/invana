/**
 * TanStack Query hooks for the ledger. Keys are `["ledger", owner, graph, …]`;
 * the ledger is append-only, so nothing here mutates — rows are read again on
 * an interval.
 */

import { type ListQuery, listQueryKey } from "@invana-studio/core";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ledgerApi } from "./api";

const key = (u?: string, g?: string, ...rest: unknown[]) =>
	["ledger", u, g, ...rest] as const;

const on = (u?: string, g?: string) => !!u && !!g;

export function useLedgerRowsQuery(u: string | undefined, g: string | undefined, query: ListQuery) {
	return useQuery({
		queryKey: key(u, g, "rows", listQueryKey(query)),
		queryFn: () => ledgerApi.rows(u as string, g as string, query),
		enabled: on(u, g),
		placeholderData: keepPreviousData,
		refetchInterval: 15_000,
	});
}

export function useLedgerStatsQuery(u: string | undefined, g: string | undefined, since = "today") {
	return useQuery({
		queryKey: key(u, g, "stats", since),
		queryFn: () => ledgerApi.stats(u as string, g as string, since),
		enabled: on(u, g),
		refetchInterval: 30_000,
	});
}

export function useLedgerRowQuery(u: string | undefined, g: string | undefined, id: string | null) {
	return useQuery({
		queryKey: key(u, g, "row", id),
		queryFn: () => ledgerApi.row(u as string, g as string, id as string),
		enabled: on(u, g) && !!id,
	});
}

export function useLedgerActorQuery(
	u: string | undefined,
	g: string | undefined,
	actor: string | null,
	since: string,
) {
	return useQuery({
		queryKey: key(u, g, "actor", actor, since),
		queryFn: () => ledgerApi.actor(u as string, g as string, actor as string, since),
		enabled: on(u, g) && !!actor,
	});
}

export function useLedgerRecordQuery(
	u: string | undefined,
	g: string | undefined,
	address: string | null,
	since: string,
) {
	return useQuery({
		queryKey: key(u, g, "record", address, since),
		queryFn: () => ledgerApi.record(u as string, g as string, address as string, since),
		enabled: on(u, g) && !!address,
	});
}

export function useLedgerRefusalsQuery(u: string | undefined, g: string | undefined) {
	return useQuery({
		queryKey: key(u, g, "refusals"),
		queryFn: () => ledgerApi.refusals(u as string, g as string),
		enabled: on(u, g),
	});
}

export function useLedgerExportsQuery(u: string | undefined, g: string | undefined) {
	return useQuery({
		queryKey: key(u, g, "exports"),
		queryFn: () => ledgerApi.exports(u as string, g as string),
		enabled: on(u, g),
	});
}

export function useLedgerIntegrityQuery(u: string | undefined, g: string | undefined) {
	return useQuery({
		queryKey: key(u, g, "integrity"),
		queryFn: () => ledgerApi.integrity(u as string, g as string),
		enabled: on(u, g),
		refetchInterval: 60_000,
	});
}
