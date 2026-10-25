/**
 * The ledger's endpoints under `/api/v1/u/{owner}/{graph}/ledger`: rows on the
 * list contract, the tiles, one row, by actor, by record, refusals, exports and
 * integrity. `exportUrl` is a link the browser downloads.
 */

import {
	type ListQuery,
	listQueryToApi,
	type Page,
	request,
} from "@invana-studio/core";
import type {
	LedgerActor,
	LedgerExport,
	LedgerIntegrity,
	LedgerPage,
	LedgerRecord,
	LedgerRefusals,
	LedgerRowDetail,
	LedgerStats,
} from "./types";

const base = (username: string, graphSlug: string) =>
	`/api/v1/u/${username}/${graphSlug}/ledger`;

const qs = (params: Record<string, string | undefined>) => {
	const p = new URLSearchParams();
	for (const [k, v] of Object.entries(params)) if (v) p.set(k, v);
	const s = p.toString();
	return s ? `?${s}` : "";
};

export const ledgerApi = {
	rows: (username: string, graphSlug: string, query: ListQuery = {}) =>
		request<LedgerPage>(`${base(username, graphSlug)}${listQueryToApi(query)}`),

	stats: (username: string, graphSlug: string, since = "today") =>
		request<LedgerStats>(`${base(username, graphSlug)}/stats${qs({ since })}`),

	row: (username: string, graphSlug: string, id: string) =>
		request<LedgerRowDetail>(`${base(username, graphSlug)}/${id}`),

	actor: (username: string, graphSlug: string, actor: string, since = "7d") =>
		request<LedgerActor>(
			`${base(username, graphSlug)}/actor${qs({ actor, since })}`,
		),

	record: (
		username: string,
		graphSlug: string,
		address: string,
		since = "30d",
	) =>
		request<LedgerRecord>(
			`${base(username, graphSlug)}/record${qs({ address, since })}`,
		),

	refusals: (username: string, graphSlug: string) =>
		request<LedgerRefusals>(`${base(username, graphSlug)}/refusals`),

	/** Past exports on the list contract, newest first. */
	exports: (username: string, graphSlug: string) =>
		request<Page<LedgerExport>>(`${base(username, graphSlug)}/exports`),

	integrity: (username: string, graphSlug: string) =>
		request<LedgerIntegrity>(`${base(username, graphSlug)}/integrity`),

	/** The export as a link: the Rows filters, in CSV or JSON Lines, with hashes. */
	exportUrl: (
		username: string,
		graphSlug: string,
		format: "csv" | "jsonl",
		query: ListQuery = {},
	) => {
		const filters = listQueryToApi(query);
		const sep = filters ? "&" : "?";
		return `${base(username, graphSlug)}/export${filters}${sep}format=${format}`;
	},
};
