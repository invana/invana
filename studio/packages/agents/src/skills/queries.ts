import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { skillsApi } from "./api";
import type { SkillCreate, SkillVersionPublish } from "./types";

const key = (username: string, graphSlug: string) =>
	["skills", username, graphSlug] as const;

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
 * next version* the same gesture.
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
 * Where this skill stands with every agent — bound, refused, not bound.
 *
 * The refusals come from the engine running both bind checks as a dry run,
 * so the tab can draw the agents a skill **cannot** be offered instead
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
export function useSkillPlaybookQuery(
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
 * Draw the playbook. The run is ordinary — it takes a slot and appears in Runs
 * — so this returns its id and the caller watches the draft for what it wrote.
 *
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

/** Pick one of the readings. The answer is recorded, so a redraw never re-asks. */
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
			qc.invalidateQueries({ queryKey: ["history", username, graphSlug] });
		},
	});
}

/** Restore an earlier version as the next one; History moves with it. */
export function useRollbackSkillMutation(
	username: string,
	graphSlug: string,
	skillId: string,
) {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: ({ version, why }: { version: number; why: string }) =>
			skillsApi.rollback(username, graphSlug, skillId, version, why),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: key(username, graphSlug) });
			qc.invalidateQueries({ queryKey: ["history", username, graphSlug] });
		},
	});
}
