import type { GraphVersionResponse } from "../../types/schemas";
import { request } from "./client";

export const schemasApi = {
	getActiveVersion: (username: string, graphSlug: string) =>
		request<GraphVersionResponse>(
			`/api/v1/u/${username}/${graphSlug}/schema/active-version`,
		),
};
