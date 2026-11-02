import { type ListQuery, listQueryKey, runsApi } from "@invana-studio/core";
import { keepPreviousData, useQuery } from "@tanstack/react-query";

// ── Thinkings behind a task ──────────────────────────────────────────────────

/**
 * The runs a task opened, in the order they were opened.
 *
 * A task's **Thoughts** tab is the same trace the session thread shows, read
 * from the other end: there, a run hangs under the reply that asked for
 * it; here, under the task it was assigned to. Both render through
 * `SessionSteps`, so a step row means one thing in Studio, not two.
 *
 * Fetched per id rather than as a list because that is the endpoint that
 * exists — and a task has one or two runs, not a page of them.
 */
/**
 * Runs as list rows — an agent's **Recent plans** (`agent_id`), a task's runs
 * (`task_id`), or the library's **candidates** (`candidates=true`: generated
 * plans that served and were never promoted).
 */
export function useRunsQuery(
	username: string | undefined,
	graphSlug: string | undefined,
	query: ListQuery = {},
	enabled = true,
) {
	return useQuery({
		queryKey: ["runs", username, graphSlug, listQueryKey(query)] as const,
		queryFn: () => runsApi.list(username as string, graphSlug as string, query),
		enabled: enabled && !!username && !!graphSlug,
		placeholderData: keepPreviousData,
	});
}
