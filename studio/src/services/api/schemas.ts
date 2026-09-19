import { request } from "@/services/api/client";
import type { GraphVersionResponse } from "@/types/schemas";

export const schemasApi = {
	getActiveVersion: (username: string, graphSlug: string) =>
		request<GraphVersionResponse>(
			`/api/v1/u/${username}/${graphSlug}/schema/active-version`,
		),
};
