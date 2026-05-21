import type { SchemaVersionResponse } from "../../types/schemas";
import { request } from "./client";

export const schemasApi = {
	getActiveVersion: (username: string, graphSlug: string) =>
		request<SchemaVersionResponse>(
			`/api/v1/u/${username}/${graphSlug}/schema/active-version`,
		),
};
