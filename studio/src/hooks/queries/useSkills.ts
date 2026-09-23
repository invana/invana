import { rulesApi, skillsApi } from "@/services/api/skills";
import type {
	RuleCreate,
	RuleUpdate,
	SkillCreate,
	SkillDraftTaskWrite,
	SkillUpdate,
	SkillVersionPublish,
} from "@/types/skills";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

const key = (username: string, graphSlug: string) =>
	["skills", username, graphSlug] as const;

const rulesKey = (username: string, graphSlug: string) =>
	["rules", username, graphSlug] as const;

export function useSkillsQuery(
	username: string | undefined,
	graphSlug: string | undefined,
) {
	return useQuery({
		queryKey: key(username ?? "", graphSlug ?? ""),
		queryFn: () => skillsApi.list(username as string, graphSlug as string),
		enabled: !!username && !!graphSlug,
	});
}

export function useSkillVersionsQuery(
	username: string,
	graphSlug: string,
	skillId: string | null,
) {
	return useQuery({
		queryKey: [...key(username, graphSlug), skillId, "versions"] as const,
		queryFn: () => skillsApi.versions(username, graphSlug, skillId as string),
		enabled: !!skillId,
	});
}

/** The prose diff against the version before. `v1` has nothing to diff against. */
export function useSkillDiffQuery(
	username: string,
	graphSlug: string,
	skillId: string | null,
	version: number | null,
) {
	return useQuery({
		queryKey: [...key(username, graphSlug), skillId, "diff", version] as const,
		queryFn: () =>
			skillsApi.diff(username, graphSlug, skillId as string, version as number),
		enabled: !!skillId && !!version,
	});
}

export function useSkillUsageQuery(
	username: string,
	graphSlug: string,
	skillId: string | null,
) {
	return useQuery({
		queryKey: [...key(username, graphSlug), skillId, "usage"] as const,
		queryFn: () => skillsApi.usage(username, graphSlug, skillId as string),
		enabled: !!skillId,
	});
}

/**
 * The draft being written — its prose, its plan, and the question the planner
 * stopped on. Opening it opens one, which is what makes *edit* and *write the
 * next version* the same gesture (SK20).
 */
export function useSkillDraftQuery(
	username: string,
	graphSlug: string,
	skillId: string | null,
	{ enabled = true, poll = false }: { enabled?: boolean; poll?: boolean } = {},
) {
	return useQuery({
		queryKey: [...key(username, graphSlug), skillId, "draft"] as const,
		queryFn: () => skillsApi.draft(username, graphSlug, skillId as string),
		enabled: !!skillId && enabled,
		// While a draw is in flight the draft is what changes — the run writes
		// rows and settles, and this is what notices. Polling stops the moment
		// the caller says the draw is over.
		refetchInterval: poll ? 1500 : false,
	});
}

/**
 * The library plans a skill may inline. A Graph-level list, not a skill's, so
 * it is keyed above the skill and shared by every editor open on one.
 */
export function useInlinablePlansQuery(
	username: string,
	graphSlug: string,
	enabled = true,
) {
	return useQuery({
		queryKey: [...key(username, graphSlug), "inlinable"] as const,
		queryFn: () => skillsApi.inlinable(username, graphSlug),
		enabled,
	});
}

/**
 * Where this skill stands with every agent — bound, refused, not bound.
 *
 * The refusals come from the engine running both bind checks as a dry run
 * (BN10), so the tab can draw the agents a skill **cannot** be offered instead
 * of finding out one click at a time.
 */
export function useSkillAgentsQuery(
	username: string,
	graphSlug: string,
	skillId: string | null,
) {
	return useQuery({
		queryKey: [...key(username, graphSlug), skillId, "agents"] as const,
		queryFn: () => skillsApi.agents(username, graphSlug, skillId as string),
		enabled: !!skillId,
	});
}

/** One version's plan — what the Flow tab draws, and where Playbook's spans come from. */
export function useSkillPlanQuery(
	username: string,
	graphSlug: string,
	skillId: string | null,
	version: number | null,
) {
	return useQuery({
		queryKey: [...key(username, graphSlug), skillId, "plan", version] as const,
		queryFn: () =>
			skillsApi.plan(username, graphSlug, skillId as string, version as number),
		enabled: !!skillId && !!version,
	});
}

export function useSaveDraftMutation(
	username: string,
	graphSlug: string,
	skillId: string,
) {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (data: SkillVersionPublish) =>
			skillsApi.saveDraft(username, graphSlug, skillId, data),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: key(username, graphSlug) });
		},
	});
}

export function useDiscardDraftMutation(
	username: string,
	graphSlug: string,
	skillId: string,
) {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: () => skillsApi.discardDraft(username, graphSlug, skillId),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: key(username, graphSlug) });
		},
	});
}

/**
 * Hand-edit the draft's plan — the correction the prose cannot make.
 *
 * The plan becomes `authored`, so the drawer row's origin badge moves and a
 * redraw becomes an offer that says what it discards (SK7). The whole subtree
 * is invalidated because the list row carries the plan summary too.
 */
export function useWriteDraftTasksMutation(
	username: string,
	graphSlug: string,
	skillId: string,
) {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (tasks: SkillDraftTaskWrite[]) =>
			skillsApi.writeDraftTasks(username, graphSlug, skillId, tasks),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: key(username, graphSlug) });
		},
	});
}

/**
 * Draw the playbook. The run is ordinary — it takes a slot and appears in Runs
 * — so this returns its id and the caller watches the draft for what it wrote
 * (SK23).
 */
export function useDrawDraftMutation(
	username: string,
	graphSlug: string,
	skillId: string,
) {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: () => skillsApi.draw(username, graphSlug, skillId),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: key(username, graphSlug) });
		},
	});
}

/** Pick one of the readings. The answer is recorded, so a redraw never re-asks (SK11). */
export function useAnswerClarificationMutation(
	username: string,
	graphSlug: string,
	skillId: string,
) {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (vars: { clarificationId: string; answer: string }) =>
			skillsApi.answer(
				username,
				graphSlug,
				skillId,
				vars.clarificationId,
				vars.answer,
			),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: key(username, graphSlug) });
		},
	});
}

/**
 * Create **and publish** v1, for a surface with no authoring flow of its own.
 *
 * `POST …/skills` leaves a draft, because the drawer's *New skill* opens the
 * editor and the person publishes when the flow is drawn (SK20). A plain form
 * that says *Skill added* and leaves an unpublished row would be telling the
 * user something that is not true, so it publishes what it just wrote.
 */
export function useCreatePublishedSkillMutation(
	username: string,
	graphSlug: string,
) {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: async (data: SkillCreate) => {
			const skill = await skillsApi.create(username, graphSlug, data);
			await skillsApi.publish(username, graphSlug, skill.id, {});
			return skill;
		},
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: key(username, graphSlug) });
		},
	});
}

export function useCreateSkillMutation(username: string, graphSlug: string) {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (data: SkillCreate) =>
			skillsApi.create(username, graphSlug, data),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: key(username, graphSlug) });
		},
	});
}

/**
 * Text that changed publishes the next version, so the version list and the
 * usage counts both move — invalidate the whole subtree, not just the list.
 */
export function useUpdateSkillMutation(username: string, graphSlug: string) {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: ({ id, data }: { id: string; data: SkillUpdate }) =>
			skillsApi.update(username, graphSlug, id, data),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: key(username, graphSlug) });
		},
	});
}

export function usePublishSkillVersionMutation(
	username: string,
	graphSlug: string,
) {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: ({ id, data }: { id: string; data: SkillVersionPublish }) =>
			skillsApi.publish(username, graphSlug, id, data),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: key(username, graphSlug) });
		},
	});
}

export function useDeleteSkillMutation(username: string, graphSlug: string) {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (id: string) => skillsApi.remove(username, graphSlug, id),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: key(username, graphSlug) });
		},
	});
}

// ── rules ────────────────────────────────────────────────────────────────────

export function useRulesQuery(
	username: string | undefined,
	graphSlug: string | undefined,
) {
	return useQuery({
		queryKey: rulesKey(username ?? "", graphSlug ?? ""),
		queryFn: () => rulesApi.list(username as string, graphSlug as string),
		enabled: !!username && !!graphSlug,
	});
}

/**
 * A Project's working rules, and the Graph invariants it inherits ([RU8]).
 *
 * The two lists arrive together and stay apart: the inherited half is
 * read-only here, so merging them would make an invariant look editable from a
 * project. Keyed under the Graph's rules, so rewording or deactivating a rule —
 * which is scope-blind, by id — refreshes both surfaces.
 */
export function useProjectRulesQuery(
	username: string,
	graphSlug: string,
	projectKey: string | null,
) {
	return useQuery({
		queryKey: [
			...rulesKey(username, graphSlug),
			"project",
			projectKey,
		] as const,
		queryFn: () =>
			rulesApi.listForProject(username, graphSlug, projectKey as string),
		enabled: !!projectKey,
	});
}

export function useRuleCitationsQuery(
	username: string,
	graphSlug: string,
	ruleId: string | null,
) {
	return useQuery({
		queryKey: [...rulesKey(username, graphSlug), ruleId, "citations"] as const,
		queryFn: () => rulesApi.citations(username, graphSlug, ruleId as string),
		enabled: !!ruleId,
	});
}

export function useCreateRuleMutation(username: string, graphSlug: string) {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (data: RuleCreate) =>
			rulesApi.create(username, graphSlug, data),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: rulesKey(username, graphSlug) });
		},
	});
}

export function useCreateProjectRuleMutation(
	username: string,
	graphSlug: string,
	projectKey: string,
) {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (data: RuleCreate) =>
			rulesApi.createForProject(username, graphSlug, projectKey, data),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: rulesKey(username, graphSlug) });
		},
	});
}

export function useUpdateRuleMutation(username: string, graphSlug: string) {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: ({ id, data }: { id: string; data: RuleUpdate }) =>
			rulesApi.update(username, graphSlug, id, data),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: rulesKey(username, graphSlug) });
		},
	});
}

/** Deactivating is how a rule stops applying. There is no delete (RU4). */
export function useSetRuleActiveMutation(username: string, graphSlug: string) {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: ({ id, active }: { id: string; active: boolean }) =>
			rulesApi.setActive(username, graphSlug, id, active),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: rulesKey(username, graphSlug) });
		},
	});
}
