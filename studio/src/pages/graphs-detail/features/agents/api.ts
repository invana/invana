/**
 * The agents endpoints under `/api/v1/u/{owner}/{graph}/agents`: list, read,
 * create, update, a lifecycle act and its preview, the soul preview, lineage,
 * skills and callables, meters and activity. Each call is one `request` on the
 * shared client and returns the engine's shape unchanged.
 */

import type {
	Agent,
	AgentCreate,
	AgentLineage,
	AgentListResponse,
	AgentMeters,
	AgentSkillsAndCallables,
	AgentUpdate,
	LifecycleAct,
	LifecyclePreview,
	SoulPreview,
	SoulPreviewRequest,
} from "@/pages/graphs-detail/features/agents/types";
import type { EventListResponse } from "@/pages/graphs-detail/features/events/types";
import { request } from "@/services/api/client";

function base(username: string, graphSlug: string): string {
	return `/api/v1/u/${username}/${graphSlug}`;
}

const json = (body: unknown) => ({ body: JSON.stringify(body) });

export const agentsApi = {
	list: (
		username: string,
		graphSlug: string,
		opts: { includeEphemeral?: boolean; includeRetired?: boolean } = {},
	) => {
		const params = new URLSearchParams();
		// Spawned helpers are hidden by default — they are still fully present
		// in lineage and the trace (docs/for-developers/modules/work/spec.md).
		if (opts.includeEphemeral) params.set("include_ephemeral", "true");
		if (opts.includeRetired) params.set("include_retired", "true");
		const q = params.toString();
		return request<AgentListResponse>(
			`${base(username, graphSlug)}/agents${q ? `?${q}` : ""}`,
		);
	},

	get: (username: string, graphSlug: string, id: string) =>
		request<Agent>(`${base(username, graphSlug)}/agents/${id}`),

	create: (username: string, graphSlug: string, data: AgentCreate) =>
		request<Agent>(`${base(username, graphSlug)}/agents`, {
			method: "POST",
			...json(data),
		}),

	update: (
		username: string,
		graphSlug: string,
		id: string,
		data: AgentUpdate,
	) =>
		request<Agent>(`${base(username, graphSlug)}/agents/${id}`, {
			method: "PATCH",
			...json(data),
		}),

	remove: (username: string, graphSlug: string, id: string) =>
		request<void>(`${base(username, graphSlug)}/agents/${id}`, {
			method: "DELETE",
		}),

	/** Offer a skill to this agent. One skill, one agent — so a refusal names it. */
	bindSkill: (
		username: string,
		graphSlug: string,
		id: string,
		skillId: string,
	) =>
		request<Agent>(
			`${base(username, graphSlug)}/agents/${id}/skills/${skillId}`,
			{ method: "POST" },
		),

	/** Stop offering it. The next run is not offered it; one in flight is unaffected. */
	unbindSkill: (
		username: string,
		graphSlug: string,
		id: string,
		skillId: string,
	) =>
		request<Agent>(
			`${base(username, graphSlug)}/agents/${id}/skills/${skillId}`,
			{ method: "DELETE" },
		),

	pause: (username: string, graphSlug: string, id: string) =>
		request<Agent>(`${base(username, graphSlug)}/agents/${id}/pause`, {
			method: "POST",
		}),

	resume: (username: string, graphSlug: string, id: string) =>
		request<Agent>(`${base(username, graphSlug)}/agents/${id}/resume`, {
			method: "POST",
		}),

	/**
	 * What the act would do — the confirm dialog names the open work item by
	 * item, and the effects are what differ between the two acts (LC8).
	 */
	lifecyclePreview: (
		username: string,
		graphSlug: string,
		id: string,
		act: LifecycleAct,
	) =>
		request<LifecyclePreview>(
			`${base(username, graphSlug)}/agents/${id}/${act}`,
		),

	retire: (
		username: string,
		graphSlug: string,
		id: string,
		reassign?: { reassign_to_kind: string; reassign_to_id: string },
	) =>
		request<Agent>(`${base(username, graphSlug)}/agents/${id}/retire`, {
			method: "POST",
			...json(reassign ?? {}),
		}),

	lineage: (username: string, graphSlug: string, id: string) =>
		request<AgentLineage>(`${base(username, graphSlug)}/agents/${id}/lineage`),

	/** Both tables of *What this agent can do*, in one read (AG30). */
	skillsAndCallables: (username: string, graphSlug: string, id: string) =>
		request<AgentSkillsAndCallables>(
			`${base(username, graphSlug)}/agents/${id}/skills-and-callables`,
		),

	/** What it is using now, beside the limits that cap it (AG31). */
	meters: (username: string, graphSlug: string, id: string) =>
		request<AgentMeters>(`${base(username, graphSlug)}/agents/${id}/meters`),

	/** Everything this agent did, newest first. */
	activity: (username: string, graphSlug: string, id: string) =>
		request<EventListResponse>(
			`${base(username, graphSlug)}/agents/${id}/activity`,
		),

	/** One ask in the current voice and the draft's — not a run (SO8). */
	previewSoul: (
		username: string,
		graphSlug: string,
		id: string,
		data: SoulPreviewRequest,
	) =>
		request<SoulPreview>(
			`${base(username, graphSlug)}/agents/${id}/soul/preview`,
			{ method: "POST", ...json(data) },
		),

	setDefault: (username: string, graphSlug: string, agentId: string) =>
		request<Agent>(`${base(username, graphSlug)}/default-agent`, {
			method: "POST",
			...json({ agent_id: agentId }),
		}),
};
