import { useQuery } from "@tanstack/react-query";
import { datasetsApi } from "../../services/api/datasets";

const root = (u: string, g: string) => ["datasets", u, g] as const;

export function useDatasetsQuery(username?: string, graphSlug?: string) {
	return useQuery({
		queryKey: root(username ?? "", graphSlug ?? ""),
		queryFn: () => datasetsApi.list(username as string, graphSlug as string),
		enabled: !!username && !!graphSlug,
	});
}

export function useDatasetJobsQuery(
	username?: string,
	graphSlug?: string,
	datasetId?: string,
) {
	return useQuery({
		queryKey: ["datasets", username, graphSlug, datasetId, "jobs"] as const,
		queryFn: () =>
			datasetsApi.jobs(
				username as string,
				graphSlug as string,
				datasetId as string,
			),
		enabled: !!username && !!graphSlug && !!datasetId,
	});
}

export function useImportJobQuery(
	username?: string,
	graphSlug?: string,
	datasetId?: string,
	jobId?: string,
) {
	return useQuery({
		queryKey: [
			"datasets",
			username,
			graphSlug,
			datasetId,
			"jobs",
			jobId,
		] as const,
		queryFn: () =>
			datasetsApi.job(
				username as string,
				graphSlug as string,
				datasetId as string,
				jobId as string,
			),
		enabled: !!username && !!graphSlug && !!datasetId && !!jobId,
	});
}
