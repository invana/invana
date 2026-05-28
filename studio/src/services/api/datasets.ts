import type {
	DatasetResponse,
	DatasetSummary,
	ImportJobResponse,
	ImportJobSummary,
} from "../../types/datasets";
import { request } from "./client";

function base(username: string, graphSlug: string): string {
	return `/api/v1/u/${username}/${graphSlug}/datasets`;
}

export const datasetsApi = {
	list: (username: string, graphSlug: string) =>
		request<DatasetSummary[]>(base(username, graphSlug)),
	get: (username: string, graphSlug: string, id: string) =>
		request<DatasetResponse>(`${base(username, graphSlug)}/${id}`),
	jobs: (username: string, graphSlug: string, id: string) =>
		request<ImportJobSummary[]>(`${base(username, graphSlug)}/${id}/jobs`),
	job: (username: string, graphSlug: string, id: string, jobId: string) =>
		request<ImportJobResponse>(
			`${base(username, graphSlug)}/${id}/jobs/${jobId}`,
		),
};
