/**
 * Who a ledger read can be about: the Graph's members (`person:<id>`) and its
 * agents (`agent:<id>`) — the keys the engine's `actor` filter takes.
 */

import { useMembersQuery } from "@invana-studio/core";
import { useMemo } from "react";
import { useAgentsQuery } from "../agents/queries";
import { EVERY } from "../lists";

export interface ActorOption {
	value: string;
	label: string;
	kind: "person" | "agent";
}

export function useActorOptions(
	username: string,
	graphSlug: string,
): ActorOption[] {
	const agents = useAgentsQuery(username, graphSlug, EVERY);
	const members = useMembersQuery({ username, graphSlug });
	return useMemo(
		() => [
			...(members.data?.items ?? []).map((m) => ({
				value: `person:${m.user_id}`,
				label: m.username,
				kind: "person" as const,
			})),
			...(agents.data?.items ?? []).map((a) => ({
				value: `agent:${a.id}`,
				label: a.name,
				kind: "agent" as const,
			})),
		],
		[members.data, agents.data],
	);
}
