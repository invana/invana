/**
 * The one request both dashboards read ([SR30](../../../../../../docs/for-developers/modules/operate/features/see-what-ran.md)).
 *
 * A run dashboard and a step dashboard are two renderings of the same
 * document, so they share a query key: opening a task from the flow paints
 * from cache and then refreshes, rather than re-fetching a trace the page it
 * came from already had.
 *
 * It polls while the run is in flight — a run in flight and a run that
 * finished are the same bands, climbing ([SR16](../../../../../../docs/for-developers/modules/operate/features/see-what-ran.md)).
 * The tail is SSE for a session ask; a dashboard is opened deliberately on any
 * kind of run, including ones with no stream open, so it asks.
 */

import { isLive } from "@/pages/graphs-detail/features/operate/dashboards/shared";
import { traceApi } from "@/services/api/runs";
import { useQuery } from "@tanstack/react-query";

const LIVE_POLL_MS = 2000;

export function useRunTrace(
	username: string,
	graphSlug: string,
	runId: string,
) {
	return useQuery({
		queryKey: ["runs", username, graphSlug, runId, "trace"] as const,
		queryFn: () => traceApi.get(username, graphSlug, runId),
		enabled: Boolean(username && graphSlug && runId),
		refetchInterval: (query) =>
			query.state.data && isLive(query.state.data.status)
				? LIVE_POLL_MS
				: false,
	});
}
