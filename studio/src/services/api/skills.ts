import { request } from "@/services/api/client";
import type {
	InlinablePlanListResponse,
	Rule,
	RuleCitationsResponse,
	RuleCreate,
	RuleListResponse,
	RuleUpdate,
	RuleVersionListResponse,
	Skill,
	SkillAgentsResponse,
	SkillCreate,
	SkillDraft,
	SkillDraftTaskWrite,
	SkillDrawStarted,
	SkillListResponse,
	SkillPlanRead,
	SkillUpdate,
	SkillUsageResponse,
	SkillVersion,
	SkillVersionDiff,
	SkillVersionListResponse,
	SkillVersionPublish,
} from "@/types/skills";

function base(username: string, graphSlug: string): string {
	return `/api/v1/u/${username}/${graphSlug}/skills`;
}

/** Rules hang off the graph and off a project, so they take the bare prefix. */
function graphBase(username: string, graphSlug: string): string {
	return `/api/v1/u/${username}/${graphSlug}`;
}

export const skillsApi = {
	list: (username: string, graphSlug: string) =>
		request<SkillListResponse>(base(username, graphSlug)),

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

	/** The draft being written — opened if it is not open yet (SK20). */
	draft: (username: string, graphSlug: string, id: string) =>
		request<SkillDraft>(`${base(username, graphSlug)}/${id}/draft`),

	/** Edit the draft's prose. A published version is never touched (SK2). */
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

	/**
	 * Hand-edit the draft's plan. The rows are replaced wholesale and the plan
	 * becomes `authored`, after which redrawing from the prose is offered rather
	 * than automatic (SK7). Bounded by the catalogue, not by an agent's envelope
	 * — an agent refuses at bind time (SK28 · BN5).
	 */
	writeDraftTasks: (
		username: string,
		graphSlug: string,
		id: string,
		tasks: SkillDraftTaskWrite[],
	) =>
		request<SkillDraft>(`${base(username, graphSlug)}/${id}/draft/tasks`, {
			method: "PATCH",
			body: JSON.stringify({ tasks }),
		}),

	/** Draw the playbook as a plan — a `role = plan` run (SK23). */
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

	/** The library plans a skill may inline, each with what it offers (LB19). */
	inlinable: (username: string, graphSlug: string) =>
		request<InlinablePlanListResponse>(
			`${base(username, graphSlug)}/inlinable`,
		),

	/** Bound, refused and not bound — the refusals are the engine's dry run (BN10). */
	agents: (username: string, graphSlug: string, id: string) =>
		request<SkillAgentsResponse>(`${base(username, graphSlug)}/${id}/agents`),

	/** One version's plan — nodes carry their band and the sentence they came from. */
	plan: (username: string, graphSlug: string, id: string, version: number) =>
		request<SkillPlanRead>(
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

	/** What this version changed against the one before it. */
	diff: (username: string, graphSlug: string, id: string, version: number) =>
		request<SkillVersionDiff>(
			`${base(username, graphSlug)}/${id}/versions/${version}/diff`,
		),

	usage: (username: string, graphSlug: string, id: string) =>
		request<SkillUsageResponse>(`${base(username, graphSlug)}/${id}/usage`),
};

export const rulesApi = {
	/** A Graph's invariants. */
	list: (username: string, graphSlug: string) =>
		request<RuleListResponse>(`${graphBase(username, graphSlug)}/rules`),

	/** A Project's working rules, with the invariants it inherits. */
	listForProject: (username: string, graphSlug: string, key: string) =>
		request<RuleListResponse>(
			`${graphBase(username, graphSlug)}/projects/${key}/rules`,
		),

	create: (username: string, graphSlug: string, data: RuleCreate) =>
		request<Rule>(`${graphBase(username, graphSlug)}/rules`, {
			method: "POST",
			body: JSON.stringify(data),
		}),

	createForProject: (
		username: string,
		graphSlug: string,
		key: string,
		data: RuleCreate,
	) =>
		request<Rule>(`${graphBase(username, graphSlug)}/projects/${key}/rules`, {
			method: "POST",
			body: JSON.stringify(data),
		}),

	/** A rewording publishes the next version; a reorder edits the row. */
	update: (username: string, graphSlug: string, id: string, data: RuleUpdate) =>
		request<Rule>(`${graphBase(username, graphSlug)}/rules/${id}`, {
			method: "PATCH",
			body: JSON.stringify(data),
		}),

	/** There is no delete: past citations must still resolve (RU4). */
	setActive: (
		username: string,
		graphSlug: string,
		id: string,
		active: boolean,
	) =>
		request<Rule>(
			`${graphBase(username, graphSlug)}/rules/${id}/${active ? "activate" : "deactivate"}`,
			{ method: "POST" },
		),

	versions: (username: string, graphSlug: string, id: string) =>
		request<RuleVersionListResponse>(
			`${graphBase(username, graphSlug)}/rules/${id}/versions`,
		),

	citations: (username: string, graphSlug: string, id: string) =>
		request<RuleCitationsResponse>(
			`${graphBase(username, graphSlug)}/rules/${id}/citations`,
		),
};
