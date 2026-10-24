/**
 * The agents endpoints under `/api/v1/u/{owner}/{graph}/agents`: list,
 * update, a lifecycle act and its preview, the soul preview, lineage,
 * skills and callables, meters and activity. Each call is one `request` on the
 * shared client and returns the engine's shape unchanged.
 */

import { type ListQuery, listQueryToApi, request } from "@invana-studio/core";
import type { EventListResponse } from "@invana-studio/shell";
import type {
	Agent,
	AgentLineage,
	AgentMeters,
	AgentPage,
	AgentSkillsAndCallables,
	AgentUpdate,
	LifecycleAct,
	LifecyclePreview,
	SoulPreview,
	SoulPreviewRequest,
} from "./types";

function base(username: string, graphSlug: string): string {
	return `/api/v1/u/${username}/${graphSlug}`;
}

const json = (body: unknown) => ({ body: JSON.stringify(body) });

export const agentsApi = {
	/** One page of the Agents list — searched, filtered and sorted by the engine. */
	list: (username: string, graphSlug: string, query: ListQuery = {}) =>
		request<AgentPage>(
			`${base(username, graphSlug)}/agents${listQueryToApi(query)}`,
		),

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
	 * item, and the effects are what differ between the two acts.
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

	/** Both tables of *What this agent can do*, in one read. */
	skillsAndCallables: (username: string, graphSlug: string, id: string) =>
		request<AgentSkillsAndCallables>(
			`${base(username, graphSlug)}/agents/${id}/skills-and-callables`,
		),

	/** What it is using now, beside the limits that cap it. */
	meters: (username: string, graphSlug: string, id: string) =>
		request<AgentMeters>(`${base(username, graphSlug)}/agents/${id}/meters`),

	/** Everything this agent did, newest first. */
	activity: (username: string, graphSlug: string, id: string) =>
		request<EventListResponse>(
			`${base(username, graphSlug)}/agents/${id}/activity`,
		),

	/** One ask in the current voice and the draft's — not a run. */
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

	/** Write the unpublished `instructions.md`. Nothing runs on it yet. */
	writeDraft: (
		username: string,
		graphSlug: string,
		id: string,
		instructions: string,
	) =>
		request<Agent>(`${base(username, graphSlug)}/agents/${id}/draft`, {
			method: "PATCH",
			...json({ instructions }),
		}),

	discardDraft: (username: string, graphSlug: string, id: string) =>
		request<Agent>(`${base(username, graphSlug)}/agents/${id}/draft`, {
			method: "DELETE",
		}),

	/** The draft becomes the instructions — through the eval gate. */
	publish: (username: string, graphSlug: string, id: string, why: string) =>
		request<Agent>(`${base(username, graphSlug)}/agents/${id}/publish`, {
			method: "POST",
			...json({ why: why || null }),
		}),

	/** A new version with the instructions as they read at `version`. */
	rollback: (
		username: string,
		graphSlug: string,
		id: string,
		version: number,
		why: string,
	) =>
		request<Agent>(`${base(username, graphSlug)}/agents/${id}/rollback`, {
			method: "POST",
			...json({ version, why: why || null }),
		}),

	setDefault: (username: string, graphSlug: string, agentId: string) =>
		request<Agent>(`${base(username, graphSlug)}/default-agent`, {
			method: "POST",
			...json({ agent_id: agentId }),
		}),
};
