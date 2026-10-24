/**
 * Every agent the Agents list holds, each beside Performance's 7-day row for
 * it — what Fleet's *Agents* card and its Table draw.
 *
 * Performance leaves out an agent that ran nothing in the window, so the rows
 * start from the list, not from Performance: every agent gets a row, and one
 * that did not run carries no `perf` (drawn `—`). The month's tokens are the
 * list's `tokens_this_month`. Joined by id; nothing is counted or summed here.
 */

import type { ListQuery } from "@invana-studio/core";
import { useMemo } from "react";
import { useAgentsQuery } from "../agents/queries";
import type { Agent, AgentPage } from "../agents/types";
import { PAGE } from "../lists";
import { useFleetPerformanceQuery } from "./queries";
import type { PerformanceRow } from "./types";

export interface FleetAgentRow {
	agent: Agent;
	/** Null when the agent ran nothing in the last 7 days. */
	perf: PerformanceRow | null;
	tokensThisMonth: number;
}

export function useFleetAgentRows(
	username: string,
	graphSlug: string,
	query: ListQuery = {},
) {
	const agents = useAgentsQuery(username, graphSlug, { ...query, limit: PAGE });
	const perf = useFleetPerformanceQuery(username, graphSlug, "7d");
	const page: AgentPage | undefined = agents.data;

	const rows = useMemo<FleetAgentRow[]>(() => {
		const byId = new Map((perf.data?.agents ?? []).map((r) => [r.id, r]));
		return (page?.items ?? []).map((agent) => ({
			agent,
			perf: byId.get(agent.id) ?? null,
			tokensThisMonth: page?.tokens_this_month[agent.id] ?? 0,
		}));
	}, [page, perf.data]);

	return {
		rows,
		page,
		loading: agents.isLoading || perf.isLoading,
		error: agents.error ?? perf.error,
	};
}
