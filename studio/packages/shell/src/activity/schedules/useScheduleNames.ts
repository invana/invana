import type { GraphRef } from "@invana-studio/core";
import { useCallback } from "react";
import { useActivitySlots } from "../ActivitySlots";
import { useChannelsQuery } from "../notifications/queries";
import type { Channel } from "../notifications/types";
import type { Schedule } from "./types";

/**
 * Names what a schedule stores by id: its agent, from the Graph's agents the
 * host hands in through `ActivitySlotsContext`, and where it delivers, from
 * the Graph's channels.
 *
 * ```tsx
 * const { agents, agentName, delivery } = useScheduleNames(graph);
 * agentName(schedule.agent_id); // "Researcher"
 * delivery(schedule);           // "In app, ops-mail"
 * ```
 *
 * An id the lists do not hold — still loading, or since removed — reads as a
 * short id, never as blank.
 */
export function useScheduleNames(graph: GraphRef) {
	const { useAgents } = useActivitySlots();
	const agents = useAgents(graph.username, graph.graphSlug).data?.items ?? [];
	const channels: Channel[] = useChannelsQuery(graph).data?.items ?? [];

	const agentName = useCallback(
		(id: string | null): string => {
			if (!id) return "no agent";
			return agents.find((a) => a.id === id)?.name ?? `agent ${id.slice(0, 8)}`;
		},
		[agents],
	);

	const delivery = useCallback(
		(s: Schedule): string => {
			const where = [
				...(s.deliver_in_app ? ["In app"] : []),
				...s.channel_ids.map(
					(id) =>
						channels.find((c) => c.id === id)?.name ??
						`channel ${id.slice(0, 8)}`,
				),
			];
			return where.length ? where.join(", ") : "delivered nowhere";
		},
		[channels],
	);

	return { agents, channels, agentName, delivery };
}
