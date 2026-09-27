import { request } from "@/services/api/client";
import type { GraphVersionResponse, PhysicalSchema } from "@/types/schemas";

export const schemasApi = {
	getActiveVersion: (username: string, graphSlug: string) =>
		request<GraphVersionResponse>(
			`/api/v1/u/${username}/${graphSlug}/schema/active-version`,
		),
	/** What the database holds, marked against the models (MP9). */
	getPhysical: (username: string, graphSlug: string, model?: string | null) =>
		request<PhysicalSchema>(
			`/api/v1/u/${username}/${graphSlug}/schema/physical${model ? `?model=${encodeURIComponent(model)}` : ""}`,
		),
};
