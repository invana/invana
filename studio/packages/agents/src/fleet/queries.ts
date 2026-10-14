/**
 * TanStack Query hooks for the fleet's reads. Keys sit under
 * `["agents", owner, graph, "fleet", …]`, so every agents mutation — a pin
 * moved, an agent paused — refreshes them with the rest of the product.
 */

import { useQuery } from "@tanstack/react-query";
import { fleetApi } from "./api";
import type { FleetWindow } from "./types";

const fleetKey = (username: string, graphSlug: string, extra: unknown[]) =>
	["agents", username, graphSlug, "fleet", ...extra] as const;

export function useFleetOverviewQuery(
	username: string | undefined,
	graphSlug: string | undefined,
) {
	return useQuery({
		queryKey: fleetKey(username ?? "", graphSlug ?? "", ["overview"]),
		queryFn: () => fleetApi.overview(username as string, graphSlug as string),
		enabled: !!username && !!graphSlug,
	});
}

export function useFleetPerformanceQuery(
	username: string | undefined,
	graphSlug: string | undefined,
	window: FleetWindow,
) {
	return useQuery({
		queryKey: fleetKey(username ?? "", graphSlug ?? "", [
			"performance",
			window,
		]),
		queryFn: () =>
			fleetApi.performance(username as string, graphSlug as string, window),
		enabled: !!username && !!graphSlug,
	});
}

export function useModelPinsQuery(
	username: string | undefined,
	graphSlug: string | undefined,
) {
	return useQuery({
		queryKey: fleetKey(username ?? "", graphSlug ?? "", ["pins"]),
		queryFn: () => fleetApi.pins(username as string, graphSlug as string),
		enabled: !!username && !!graphSlug,
	});
}
