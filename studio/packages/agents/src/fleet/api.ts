import { request } from "@invana-studio/core";
import type {
	FleetOverview,
	FleetPerformance,
	FleetWindow,
	ModelPins,
} from "./types";

const graph = (username: string, graphSlug: string) =>
	`/api/v1/u/${username}/${graphSlug}`;

/**
 * The fleet's three reads — the Overview and Performance pages and who pins
 * each model. Read-only: every act on those pages is a link elsewhere.
 */
export const fleetApi = {
	overview: (username: string, graphSlug: string) =>
		request<FleetOverview>(`${graph(username, graphSlug)}/agents/overview`),

	performance: (username: string, graphSlug: string, window: FleetWindow) =>
		request<FleetPerformance>(
			`${graph(username, graphSlug)}/agents/performance?window=${window}`,
		),

	pins: (username: string, graphSlug: string) =>
		request<ModelPins>(`${graph(username, graphSlug)}/llm/pins`),
};
