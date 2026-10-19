/**
 * TanStack Query hooks for the Datasets product.
 *
 * Keys start `["datasets", publisher, name]` for one dataset and
 * `["standards", …]` for the library, so a write invalidates exactly the
 * dataset it touched. The catalogue's key is `["datasets", "catalogue", …]`;
 * every dataset write invalidates the `["datasets"]` prefix, because a version,
 * a share or a retraction changes the catalogue row too.
 *
 * Two reads span the catalogue, each one request: `useClaims` (every claim on
 * every readable dataset, with the claims per standard) and
 * `useValidationQueue` (every violation, with the engine's totals).
 */

import { useGraphsQuery } from "@invana-studio/core";
import {
	type QueryClient,
	useMutation,
	useQueries,
	useQuery,
	useQueryClient,
} from "@tanstack/react-query";
import {
	bindingsApi,
	type CatalogueFilter,
	type DatasetRef,
	datasetsApi,
	standardsApi,
} from "./api";
import type {
	Dataset,
	DatasetRecord,
	DatasetStandardCreate,
	DatasetUpdate,
	DatasetVersion,
	DatasetVersionListResponse,
	SkosImportRequest,
	StandardCreate,
} from "./types";

const dsKey = (d: DatasetRef, ...extra: unknown[]) =>
	["datasets", d.publisher, d.name, ...extra] as const;

export function useCatalogueQuery(filter: CatalogueFilter = {}) {
	return useQuery({
		queryKey: ["datasets", "catalogue", filter],
		queryFn: () => datasetsApi.list(filter),
	});
}

export function useDatasetQuery(d: DatasetRef) {
	return useQuery({ queryKey: dsKey(d), queryFn: () => datasetsApi.get(d) });
}

export function useVersionsQuery(d: DatasetRef) {
	return useQuery({
		queryKey: dsKey(d, "versions"),
		queryFn: () => datasetsApi.versions(d),
		enabled: !!d.name,
	});
}

export function useRecordsQuery(
	d: DatasetRef,
	version: number | null,
	offset = 0,
	limit = 50,
	provenance = false,
) {
	return useQuery({
		queryKey: dsKey(d, "records", version, offset, limit, provenance),
		queryFn: () =>
			datasetsApi.records(d, version ?? 0, offset, limit, provenance),
		enabled: version !== null,
	});
}

export function useRecordQuery(d: DatasetRef, key: string) {
	return useQuery({
		queryKey: dsKey(d, "record", key),
		queryFn: () => datasetsApi.record(d, key),
	});
}

export function useRecordHistoryQuery(d: DatasetRef, key: string) {
	return useQuery({
		queryKey: dsKey(d, "record", key, "history"),
		queryFn: () => datasetsApi.recordHistory(d, key),
	});
}

/** The dataset's versions, each with who published it. */
export function useDatasetHistoryQuery(d: DatasetRef) {
	return useQuery({
		queryKey: dsKey(d, "history"),
		queryFn: () => datasetsApi.history(d),
	});
}

/**
 * What cites the given versions of one dataset, merged into one read. The
 * engine answers per version, so this fans out under one hook; the page sees
 * a single loading state and a single list.
 */
export function useUsageQuery(d: DatasetRef, versions: number[]) {
	return useQueries({
		queries: versions.map((v) => ({
			queryKey: dsKey(d, "used", v),
			queryFn: () => datasetsApi.used(d, v),
		})),
		combine: (results) => ({
			isLoading: results.some((r) => r.isLoading),
			items: results.flatMap((r, i) =>
				r.data ? [{ version: versions[i] as number, usage: r.data }] : [],
			),
		}),
	});
}

/** The standards one dataset claims, each with its current conformance. */
export function useDatasetStandardsQuery(d: DatasetRef) {
	return useQuery({
		queryKey: dsKey(d, "standards"),
		queryFn: () => datasetsApi.standards(d),
	});
}

/**
 * Every claim on every dataset the person can read, in one request; `standard`
 * (`publisher/name`) narrows it. A dataset whose claims cannot be read is
 * counted in `unreadable`, not hidden.
 */
export function useClaimsQuery(standard?: string) {
	return useQuery({
		queryKey: ["datasets", "claims", standard ?? ""],
		queryFn: () => datasetsApi.claims(standard),
	});
}

/** The validation queue, with the engine's totals. */
export function useValidationQueue() {
	return useQuery({
		queryKey: ["datasets", "validation"],
		queryFn: () => datasetsApi.validation(),
	});
}

export function useStandardsQuery(q?: string) {
	return useQuery({
		queryKey: ["standards", "library", q ?? ""],
		queryFn: () => standardsApi.list(q),
	});
}

export function useStandardQuery(s: DatasetRef) {
	return useQuery({
		queryKey: ["standards", s.publisher, s.name],
		queryFn: () => standardsApi.get(s),
		enabled: !!s.name,
	});
}

/** Every record of one version, page by page — for building the next one. */
async function readAll(
	d: DatasetRef,
	version: number,
): Promise<DatasetRecord[]> {
	const out: DatasetRecord[] = [];
	for (let offset = 0; ; offset += 1000) {
		const page = await datasetsApi.records(d, version, offset, 1000);
		out.push(...page.items);
		if (out.length >= page.total || page.items.length === 0) return out;
	}
}

/**
 * Every record of `base`, refused when the dataset has moved past it since the
 * page read it. The engine publishes whatever it is sent, so this narrows —
 * not closes — the window in which two writers drop each other's change.
 */
export async function readBase(
	d: DatasetRef,
	base: number,
): Promise<DatasetRecord[]> {
	const now = (await datasetsApi.get(d)).current_version;
	if (now !== base) {
		throw new Error(
			`v${now} was published while you were editing v${base}. Close and reopen to start from v${now}.`,
		);
	}
	return readAll(d, base);
}

/**
 * Folds a version the engine just minted into the cached dataset and its
 * version list, then reads everything else under `["datasets"]` again. The
 * two folded keys are not refetched: the engine commits after it answers, so
 * a read sent the moment the save returns can still see the old version and
 * would put it back.
 */
export function foldPublished(
	qc: QueryClient,
	d: DatasetRef,
	v: DatasetVersion,
) {
	qc.setQueryData<Dataset>(dsKey(d), (old) =>
		old
			? {
					...old,
					current_version: v.version,
					record_count: v.record_count,
					licence: v.licence,
				}
			: old,
	);
	qc.setQueryData<DatasetVersionListResponse>(dsKey(d, "versions"), (old) =>
		old && !old.items.some((x) => x.version === v.version)
			? { items: [v, ...old.items], total: old.total + 1 }
			: old,
	);
	const folded = [dsKey(d), dsKey(d, "versions")].map((k) => JSON.stringify(k));
	void qc.invalidateQueries({
		queryKey: ["datasets"],
		predicate: (q) => !folded.includes(JSON.stringify(q.queryKey)),
	});
}

function useDatasetWrite<V, R>(fn: (vars: V) => Promise<R>) {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: fn,
		onSuccess: () => qc.invalidateQueries({ queryKey: ["datasets"] }),
	});
}

/**
 * Metadata only, so the response is the whole new dataset: it replaces the
 * cached one, and only the catalogue — whose row shows it — is read again.
 */
export function useUpdateDataset(d: DatasetRef) {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (data: DatasetUpdate) => datasetsApi.update(d, data),
		onSuccess: (dataset: Dataset) => {
			qc.setQueryData(dsKey(d), dataset);
			void qc.invalidateQueries({ queryKey: ["datasets", "catalogue"] });
		},
	});
}

export function useRetractVersion(d: DatasetRef) {
	return useDatasetWrite(
		({ version, reason }: { version: number; reason: string }) =>
			datasetsApi.retract(d, version, reason),
	);
}

export function useAttachStandard(d: DatasetRef) {
	return useDatasetWrite((data: DatasetStandardCreate) =>
		datasetsApi.attach(d, data),
	);
}

export function useDetachStandard(d: DatasetRef) {
	return useDatasetWrite((standard: DatasetRef) =>
		datasetsApi.detach(d, standard),
	);
}

export function useCreateStandard() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (data: StandardCreate) => standardsApi.create(data),
		onSuccess: () => qc.invalidateQueries({ queryKey: ["standards"] }),
	});
}

/** A SKOS preview — the import with `dry_run`; it writes nothing, so it invalidates nothing. */
export function usePreviewSkos() {
	return useMutation({
		mutationFn: (data: Omit<SkosImportRequest, "dry_run">) =>
			standardsApi.importSkos({ ...data, dry_run: true }),
	});
}

/** A SKOS import — creates the standard, mints its next version, or writes nothing when unchanged. */
export function useImportSkos() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (data: Omit<SkosImportRequest, "dry_run">) =>
			standardsApi.importSkos({ ...data, dry_run: false }),
		onSuccess: () => qc.invalidateQueries({ queryKey: ["standards"] }),
	});
}

// ── Bind ─────────────────────────────────────────────────────────────────────

/** The Graphs the person belongs to — where a version can be bound. */
export function useBindTargets() {
	return useGraphsQuery();
}

export function useModelsQuery(username: string, graphSlug: string) {
	return useQuery({
		queryKey: ["models", username, graphSlug, "for-bind"],
		queryFn: () => bindingsApi.models(username, graphSlug),
		enabled: !!username && !!graphSlug,
	});
}

export function useModelTypesQuery(
	username: string,
	graphSlug: string,
	modelId: string,
) {
	return useQuery({
		queryKey: ["models", username, graphSlug, modelId, "active-version"],
		queryFn: () => bindingsApi.activeVersion(username, graphSlug, modelId),
		enabled: !!modelId,
	});
}

export function useBind() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: ({
			username,
			graphSlug,
			...data
		}: {
			username: string;
			graphSlug: string;
			dataset: string;
			model: string;
			type: string;
		}) => bindingsApi.bind(username, graphSlug, data),
		onSuccess: (_, v) => {
			void qc.invalidateQueries({ queryKey: ["datasets"] });
			void qc.invalidateQueries({
				queryKey: ["runs", v.username, v.graphSlug],
			});
		},
	});
}
