/**
 * TanStack Query hooks for a subject's evals. Keys are
 * `["evals", owner, graph, kind, id, …]`; an eval run is polled until it
 * settles, because the engine replays the cases after answering the open.
 */

import { ApiError } from "@invana-studio/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { evalsApi } from "./api";
import type {
	EvalCase,
	EvalCaseWrite,
	EvalRefusal,
	EvalRun,
	EvalRunOpen,
	EvalSet,
	EvalSubjectKind,
} from "./types";

const SETTLED = new Set(["succeeded", "failed", "cancelled", "skipped"]);

/** Whether an eval run has stopped moving. */
export const isSettled = (run: EvalRun | undefined) =>
	!!run && SETTLED.has(run.status);

export function useEvalSetQuery(
	username: string,
	graphSlug: string,
	kind: EvalSubjectKind,
	id: string,
) {
	return useQuery({
		queryKey: ["evals", username, graphSlug, kind, id, "set"],
		queryFn: () => evalsApi.set(username, graphSlug, kind, id),
	});
}

/** One eval run, polled every 2 s while it runs. */
export function useEvalRunQuery(
	username: string,
	graphSlug: string,
	kind: EvalSubjectKind,
	id: string,
	runId: string | null,
) {
	return useQuery({
		queryKey: ["evals", username, graphSlug, kind, id, "run", runId],
		queryFn: () => evalsApi.run(username, graphSlug, kind, id, runId as string),
		enabled: !!runId,
		refetchInterval: (q) => (isSettled(q.state.data) ? false : 2000),
	});
}

export function useEvalMutations(
	username: string,
	graphSlug: string,
	kind: EvalSubjectKind,
	id: string,
) {
	const qc = useQueryClient();
	const invalidate = () =>
		qc.invalidateQueries({
			queryKey: ["evals", username, graphSlug, kind, id],
		});
	// The engine commits after its response is sent, so a refetch made the
	// moment a case write answers can read the set from before it. Each case
	// write folds its own answer into the cached set instead.
	const patchCases = (fold: (cases: EvalCase[]) => EvalCase[]) =>
		qc.setQueryData<EvalSet>(
			["evals", username, graphSlug, kind, id, "set"],
			(set) => (set ? { ...set, cases: fold(set.cases) } : set),
		);
	const upsert = (made: EvalCase[]) =>
		patchCases((cases) => [
			...cases.filter((c) => !made.some((m) => m.id === c.id)),
			...made,
		]);
	return {
		addCase: useMutation({
			mutationFn: (data: EvalCaseWrite) =>
				evalsApi.addCase(username, graphSlug, kind, id, data),
			onSuccess: (made) => upsert([made]),
		}),
		acceptCase: useMutation({
			mutationFn: (caseId: string) =>
				evalsApi.updateCase(username, graphSlug, kind, id, caseId, {
					status: "active",
				}),
			onSuccess: (made) =>
				patchCases((cases) => cases.map((c) => (c.id === made.id ? made : c))),
		}),
		deleteCase: useMutation({
			mutationFn: (caseId: string) =>
				evalsApi.deleteCase(username, graphSlug, kind, id, caseId),
			onSuccess: (_, caseId) =>
				patchCases((cases) => cases.filter((c) => c.id !== caseId)),
		}),
		propose: useMutation({
			mutationFn: () => evalsApi.propose(username, graphSlug, kind, id),
			onSuccess: upsert,
		}),
		open: useMutation({
			mutationFn: (data: EvalRunOpen) =>
				evalsApi.open(username, graphSlug, kind, id, data),
			onSuccess: invalidate,
		}),
	};
}

const GATE_ERRORS = new Set([
	"eval_required",
	"eval_running",
	"eval_failed",
	"eval_warned",
]);

/** The eval gate's refusal inside an error, or null when it is another one. */
export function asEvalRefusal(error: unknown): EvalRefusal | null {
	if (!(error instanceof ApiError) || error.status !== 409) return null;
	const detail = error.detail as Partial<EvalRefusal> | undefined;
	return detail &&
		typeof detail === "object" &&
		GATE_ERRORS.has(`${detail.error}`)
		? (detail as EvalRefusal)
		: null;
}
