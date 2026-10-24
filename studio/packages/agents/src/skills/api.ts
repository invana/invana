import { type ListQuery, listQueryToApi, request } from "@invana-studio/core";
import type {
	Skill,
	SkillAgentsResponse,
	SkillCreate,
	SkillDraft,
	SkillDrawStarted,
	SkillPage,
	SkillPlaybookRead,
	SkillUpdate,
	SkillUsageResponse,
	SkillVersion,
	SkillVersionDiff,
	SkillVersionListResponse,
	SkillVersionPublish,
} from "./types";

function base(username: string, graphSlug: string): string {
	return `/api/v1/u/${username}/${graphSlug}/skills`;
}

export const skillsApi = {
	/** One page of the Skills list — searched, filtered and sorted by the engine. */
	list: (username: string, graphSlug: string, query: ListQuery = {}) =>
		request<SkillPage>(`${base(username, graphSlug)}${listQueryToApi(query)}`),

	get: (username: string, graphSlug: string, id: string) =>
		request<Skill>(`${base(username, graphSlug)}/${id}`),

	create: (username: string, graphSlug: string, data: SkillCreate) =>
		request<Skill>(base(username, graphSlug), {
			method: "POST",
			body: JSON.stringify(data),
		}),

	/** Text that changed publishes the next version; a rename does not. */
	update: (
		username: string,
		graphSlug: string,
		id: string,
		data: SkillUpdate,
	) =>
		request<Skill>(`${base(username, graphSlug)}/${id}`, {
			method: "PATCH",
			body: JSON.stringify(data),
		}),

	remove: (username: string, graphSlug: string, id: string) =>
		request<void>(`${base(username, graphSlug)}/${id}`, { method: "DELETE" }),

	/** The draft being written — opened if it is not open yet. */
	draft: (username: string, graphSlug: string, id: string) =>
		request<SkillDraft>(`${base(username, graphSlug)}/${id}/draft`),

	/** Edit the draft's prose. A published version is never touched. */
	saveDraft: (
		username: string,
		graphSlug: string,
		id: string,
		data: SkillVersionPublish,
	) =>
		request<SkillDraft>(`${base(username, graphSlug)}/${id}/draft`, {
			method: "PATCH",
			body: JSON.stringify(data),
		}),

	discardDraft: (username: string, graphSlug: string, id: string) =>
		request<void>(`${base(username, graphSlug)}/${id}/draft`, {
			method: "DELETE",
		}),

	/** Draw the playbook as a plan — a `role = plan` run. */
	draw: (username: string, graphSlug: string, id: string) =>
		request<SkillDrawStarted>(`${base(username, graphSlug)}/${id}/draft/draw`, {
			method: "POST",
		}),

	/** Pick one of the readings the planner offered. Never free text. */
	answer: (
		username: string,
		graphSlug: string,
		id: string,
		clarificationId: string,
		answer: string,
	) =>
		request<SkillDraft>(
			`${base(username, graphSlug)}/${id}/draft/clarifications/${clarificationId}`,
			{ method: "POST", body: JSON.stringify({ answer }) },
		),

	/** Bound, refused and not bound — the refusals are the engine's dry run. */
	agents: (username: string, graphSlug: string, id: string) =>
		request<SkillAgentsResponse>(`${base(username, graphSlug)}/${id}/agents`),

	/** One version's plan — nodes carry their band and the sentence they came from. */
	plan: (username: string, graphSlug: string, id: string, version: number) =>
		request<SkillPlaybookRead>(
			`${base(username, graphSlug)}/${id}/versions/${version}/tasks`,
		),

	versions: (username: string, graphSlug: string, id: string) =>
		request<SkillVersionListResponse>(
			`${base(username, graphSlug)}/${id}/versions`,
		),

	/** Publish the next version. Fields left out carry over from the current one. */
	publish: (
		username: string,
		graphSlug: string,
		id: string,
		data: SkillVersionPublish,
	) =>
		request<SkillVersion>(`${base(username, graphSlug)}/${id}/versions`, {
			method: "POST",
			body: JSON.stringify(data),
		}),

	/** Restore `version` as the next one — through the eval gate. */
	rollback: (
		username: string,
		graphSlug: string,
		id: string,
		version: number,
		why: string,
	) =>
		request<SkillVersion>(`${base(username, graphSlug)}/${id}/rollback`, {
			method: "POST",
			body: JSON.stringify({ version, why: why || null }),
		}),

	/** What this version changed against the one before it. */
	diff: (username: string, graphSlug: string, id: string, version: number) =>
		request<SkillVersionDiff>(
			`${base(username, graphSlug)}/${id}/versions/${version}/diff`,
		),

	usage: (username: string, graphSlug: string, id: string) =>
		request<SkillUsageResponse>(`${base(username, graphSlug)}/${id}/usage`),
};
