/**
 * The Datasets product's endpoints: the install-wide catalogue
 * (`/api/v1/datasets`), the standards library (`/api/v1/standards`), and the
 * two Graph-scoped reads a bind needs — the Graph's dataset bindings and its
 * models. Each call is one `request` on the shared client.
 */

import { request } from "@invana-studio/core";
import type {
	Dataset,
	DatasetBinding,
	DatasetBindingListResponse,
	DatasetHistory,
	DatasetListResponse,
	DatasetRecord,
	DatasetRecordPage,
	DatasetStandard,
	DatasetStandardCreate,
	DatasetStandardListResponse,
	DatasetUpdate,
	DatasetVersion,
	DatasetVersionCreate,
	DatasetVersionListResponse,
	DatasetVersionUsage,
	ModelSummary,
	ModelVersionTypes,
	RecordChangeLog,
	SkosImportRequest,
	SkosImportResult,
	Standard,
	StandardCreate,
	StandardListResponse,
} from "./types";

export interface DatasetRef {
	publisher: string;
	name: string;
}

export interface CatalogueFilter {
	origin?: string;
	publisher?: string;
	/** `owner/graph` */
	boundIn?: string;
	q?: string;
}

const DATASETS = "/api/v1/datasets";
const STANDARDS = "/api/v1/standards";

const one = (d: DatasetRef) =>
	`${DATASETS}/${encodeURIComponent(d.publisher)}/${encodeURIComponent(d.name)}`;

const json = (method: "POST" | "PATCH", body: unknown) => ({
	method,
	body: JSON.stringify(body),
});

function query(params: Record<string, string | number | undefined>): string {
	const q = new URLSearchParams();
	for (const [k, v] of Object.entries(params)) {
		if (v !== undefined && v !== "") q.set(k, String(v));
	}
	const s = q.toString();
	return s ? `?${s}` : "";
}

export const datasetsApi = {
	list: (f: CatalogueFilter = {}) =>
		request<DatasetListResponse>(
			`${DATASETS}${query({ origin: f.origin, publisher: f.publisher, bound_in: f.boundIn, q: f.q })}`,
		),

	get: (d: DatasetRef) => request<Dataset>(one(d)),

	/** Metadata only — visibility, labels, title; never a version. */
	update: (d: DatasetRef, data: DatasetUpdate) =>
		request<Dataset>(one(d), json("PATCH", data)),

	versions: (d: DatasetRef) =>
		request<DatasetVersionListResponse>(`${one(d)}/versions`),

	publish: (d: DatasetRef, data: DatasetVersionCreate) =>
		request<DatasetVersion>(`${one(d)}/versions`, json("POST", data)),

	records: (d: DatasetRef, version: number, offset = 0, limit = 100) =>
		request<DatasetRecordPage>(
			`${one(d)}/versions/${version}/records${query({ offset, limit })}`,
		),

	record: (d: DatasetRef, key: string) =>
		request<DatasetRecord>(`${one(d)}/records/${encodeURIComponent(key)}`),

	recordHistory: (d: DatasetRef, key: string) =>
		request<RecordChangeLog>(
			`${one(d)}/records/${encodeURIComponent(key)}/history`,
		),

	/** The dataset's versions with who made each — the change log's names. */
	history: (d: DatasetRef) => request<DatasetHistory>(`${one(d)}/history`),

	/** What changed between two versions — the change log's compare. */
	compare: (d: DatasetRef, a: number, b: number) =>
		request<{ summary: string }>(
			`${one(d)}/history/compare${query({ a: String(a), b: String(b) })}`,
		),

	used: (d: DatasetRef, version: number) =>
		request<DatasetVersionUsage>(`${one(d)}/versions/${version}/used`),

	/** An install Admin's act; the version stays readable, marked. */
	retract: (d: DatasetRef, version: number, reason: string) =>
		request<DatasetVersion>(
			`${one(d)}/versions/${version}/retract`,
			json("POST", { reason }),
		),

	standards: (d: DatasetRef) =>
		request<DatasetStandardListResponse>(`${one(d)}/standards`),

	attach: (d: DatasetRef, data: DatasetStandardCreate) =>
		request<DatasetStandard>(`${one(d)}/standards`, json("POST", data)),

	detach: (d: DatasetRef, standard: DatasetRef) =>
		request<void>(
			`${one(d)}/standards/${encodeURIComponent(standard.publisher)}/${encodeURIComponent(standard.name)}`,
			{ method: "DELETE" },
		),
};

export const standardsApi = {
	list: (q?: string) =>
		request<StandardListResponse>(`${STANDARDS}${query({ q })}`),

	get: (s: DatasetRef) =>
		request<Standard>(
			`${STANDARDS}/${encodeURIComponent(s.publisher)}/${encodeURIComponent(s.name)}`,
		),

	create: (data: StandardCreate) =>
		request<Standard>(STANDARDS, json("POST", data)),

	/** A SKOS concept scheme → a standard; `dry_run` previews and writes nothing. */
	importSkos: (data: SkosImportRequest) =>
		request<SkosImportResult>(`${STANDARDS}/import/skos`, json("POST", data)),
};

function graphBase(username: string, graphSlug: string): string {
	return `/api/v1/u/${username}/${graphSlug}`;
}

export const bindingsApi = {
	list: (username: string, graphSlug: string) =>
		request<DatasetBindingListResponse>(
			`${graphBase(username, graphSlug)}/dataset-bindings`,
		),

	/** Opens the load run; follow it on the run's page. */
	bind: (
		username: string,
		graphSlug: string,
		data: { dataset: string; model: string; type: string },
	) =>
		request<DatasetBinding>(
			`${graphBase(username, graphSlug)}/dataset-bindings`,
			json("POST", data),
		),

	models: (username: string, graphSlug: string) =>
		request<ModelSummary[]>(`${graphBase(username, graphSlug)}/models`),

	activeVersion: (username: string, graphSlug: string, modelId: string) =>
		request<ModelVersionTypes>(
			`${graphBase(username, graphSlug)}/models/${modelId}/active-version`,
		),
};

/** `publisher/name[@v]` → its parts. */
export function parseAddress(address: string): DatasetRef & {
	version: number | null;
} {
	const [path, v] = address.split("@");
	const [publisher = "", name = ""] = (path ?? "").split("/");
	return { publisher, name, version: v ? Number(v) : null };
}
