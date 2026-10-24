import {
	type ListQuery,
	listQueryToApi,
	type Page,
	request,
} from "@invana-studio/core";
import type {
	Skill,
	SkillAgentsResponse,
	SkillCreate,
	SkillDraft,
	SkillDrawStarted,
	SkillExceptions,
	SkillExceptionsWindow,
	SkillPage,
	SkillPlanCompare,
	SkillPlaybookRead,
	SkillTestRead,
	SkillTestStarted,
	SkillUsageResponse,
	SkillVersion,
	SkillVersionDiff,
	SkillVersionPublish,
} from "./types";

function base(username: string, graphSlug: string): string {
	return `/api/v1/u/${username}/${graphSlug}/skills`;
}

export const skillsApi = {
	/** One page of the Skills list — searched, filtered and sorted by the engine. */
	list: (username: string, graphSlug: string, query: ListQuery = {}) =>
		request<SkillPage>(`${base(username, graphSlug)}${listQueryToApi(query)}`),

	create: (username: string, graphSlug: string, data: SkillCreate) =>
		request<Skill>(base(username, graphSlug), {
			method: "POST",
			body: JSON.stringify(data),
		}),

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

	/** What publishing `version` regenerated in the plan, against the one before. */
	planCompare: (
		username: string,
		graphSlug: string,
		id: string,
		version: number,
	) =>
		request<SkillPlanCompare>(
			`/api/v1/u/${username}/${graphSlug}/history/skill/${encodeURIComponent(id)}/compare?b=${version}`,
		),

	usage: (username: string, graphSlug: string, id: string) =>
		request<SkillUsageResponse>(`${base(username, graphSlug)}/${id}/usage`),

	/** Replans over the runs offered this skill in the window. */
	exceptions: (
		username: string,
		graphSlug: string,
		id: string,
		window: SkillExceptionsWindow = "30d",
	) =>
		request<SkillExceptions>(
			`${base(username, graphSlug)}/${id}/exceptions?window=${window}`,
		),

	/** The skill's test runs, newest first. */
	tests: (
		username: string,
		graphSlug: string,
		id: string,
		query: ListQuery = {},
	) =>
		request<Page<SkillTestRead>>(
			`${base(username, graphSlug)}/${id}/tests${listQueryToApi(query)}`,
		),

	/** *Run a test*: one question, a real run of the draft (or the head). */
	startTest: (
		username: string,
		graphSlug: string,
		id: string,
		question: string,
	) =>
		request<SkillTestStarted>(`${base(username, graphSlug)}/${id}/tests`, {
			method: "POST",
			body: JSON.stringify({ question }),
		}),
};
