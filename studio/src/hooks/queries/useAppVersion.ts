import { useQuery } from "@tanstack/react-query";
import { healthApi } from "../../services/api/health";

const KEY = ["app", "health"] as const;

/**
 * Engine app info (version, app name, db status). Backed by the engine's
 * `/health` endpoint. Cached across the whole app and revalidated every
 * 5 minutes — the version never changes within a running engine, so a
 * long stale window is fine.
 */
export function useAppVersionQuery() {
	return useQuery({
		queryKey: KEY,
		queryFn: healthApi.get,
		staleTime: 5 * 60 * 1000,
		refetchOnWindowFocus: false,
	});
}
