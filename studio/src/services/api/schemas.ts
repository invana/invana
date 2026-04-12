import type { SchemaVersionResponse } from "../../types/schemas";
import { request } from "./client";

export const schemasApi = {
	getActiveVersion: (schemaId: string) =>
		request<SchemaVersionResponse>(
			`/api/v1/schemas/${schemaId}/active-version`,
		),
};
