import { type ListQuery, listQueryKey } from "@invana-studio/core";
import {
	keepPreviousData,
	useMutation,
	useQueries,
	useQuery,
	useQueryClient,
} from "@tanstack/react-query";
import { useMemo } from "react";
import { skillsApi } from "./api";
import type {
	SkillCreate,
	SkillExceptionsWindow,
	SkillPlaybookRead,
	SkillVersionPublish,
} from "./types";

const key = (username: string, graphSlug: string) =>
	["skills", username, graphSlug] as const;

/** One page of the Skills list for `query`; a caller that needs every skill asks `limit: 200`. */
export function useSkillsQuery(
	username: string | undefined,
	graphSlug: string | undefined,
	query: ListQuery = {},
) {
	return useQuery({
		queryKey: [
			...key(username ?? "", graphSlug ?? ""),
			"list",
			listQueryKey(query),
		],
		queryFn: () =>
			skillsApi.list(username as string, graphSlug as string, query),
		enabled: !!username && !!graphSlug,
		placeholderData: keepPreviousData,
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

/**
 * The plan diff one publish made — the history compare read, keyed as the
 * shell's compare board keys it, so a publish's history refresh refreshes it.
 */
export function useSkillPlanCompareQuery(
	username: string,
	graphSlug: string,
	skillId: string,
	version: number | null,
) {
	return useQuery({
		queryKey: [
			"history",
			username,
			graphSlug,
			"skill",
			skillId,
			"compare",
			null,
			version === null ? null : String(version),
		],
		queryFn: () =>
			skillsApi.planCompare(username, graphSlug, skillId, version as number),
		enabled: version !== null,
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

/** Replans over the runs offered this skill; the window is part of the key. */
export function useSkillExceptionsQuery(
	username: string,
	graphSlug: string,
	skillId: string | null,
	window: SkillExceptionsWindow = "30d",
) {
	return useQuery({
		queryKey: [
			...key(username, graphSlug),
			skillId,
			"exceptions",
			window,
		] as const,
		queryFn: () =>
			skillsApi.exceptions(username, graphSlug, skillId as string, window),
		enabled: !!skillId,
	});
}

/**
 * The skill's test runs, newest first. While one has not finished the list
 * polls, so a run started here settles on screen.
 */
export function useSkillTestsQuery(
	username: string,
	graphSlug: string,
	skillId: string | null,
) {
	return useQuery({
		queryKey: [...key(username, graphSlug), skillId, "tests"] as const,
		queryFn: () => skillsApi.tests(username, graphSlug, skillId as string),
		enabled: !!skillId,
		refetchInterval: (q) =>
			q.state.data?.items.some((t) => t.finished_at === null) ? 2000 : false,
	});
}

/** *Run a test* — takes the question; the list picks the run up. */
export function useStartSkillTestMutation(
	username: string,
	graphSlug: string,
	skillId: string,
) {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (question: string) =>
			skillsApi.startTest(username, graphSlug, skillId, question),
		onSuccess: () => {
			qc.invalidateQueries({
				queryKey: [...key(username, graphSlug), skillId, "tests"],
			});
		},
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

/**
 * The published plan of each skill in `skills`, one read apiece — what the
 * fleet map reads each skill's functions off. A skill never published is
 * offered nothing, so it is not read. Shares its keys with
 * {@link useSkillPlaybookQuery}, so a plan read here is not read again there.
 */
export function useSkillPlaybooksQuery(
	username: string,
	graphSlug: string,
	skills: { id: string; version: number; is_draft: boolean }[],
) {
	const published = useMemo(
		() => skills.filter((s) => !s.is_draft && s.version > 0),
		[skills],
	);
	const { data, pending } = useQueries({
		queries: published.map((s) => ({
			queryKey: [...key(username, graphSlug), s.id, "plan", s.version],
			queryFn: () => skillsApi.plan(username, graphSlug, s.id, s.version),
			enabled: !!username && !!graphSlug,
		})),
		combine: playbooks,
	});
	/** `{skillId: its plan}`, for every plan read so far. */
	const plans = useMemo(() => {
		const out = new Map<string, SkillPlaybookRead>();
		data.forEach((plan, i) => {
			if (plan && published[i]) out.set(published[i].id, plan);
		});
		return out;
	}, [data, published]);
	return { plans, pending };
}

/** Module-level, so the combined result keeps its identity between renders. */
function playbooks(
	results: { data?: SkillPlaybookRead; isPending: boolean }[],
) {
	return {
		data: results.map((r) => r.data),
		pending: results.some((r) => r.isPending),
	};
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
