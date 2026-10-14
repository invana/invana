/**
 * The eval endpoints under `/api/v1/u/{owner}/{graph}/evals/{kind}/{id}`: the
 * subject's set and its cases, a starter set proposed from the instructions,
 * and the eval runs that replay the set against live and draft.
 */

import { request } from "@invana-studio/core";
import type {
	EvalCase,
	EvalCaseWrite,
	EvalRun,
	EvalRunOpen,
	EvalRunOpened,
	EvalSet,
	EvalSubjectKind,
} from "./types";

function base(
	username: string,
	graphSlug: string,
	kind: EvalSubjectKind,
	id: string,
): string {
	return `/api/v1/u/${username}/${graphSlug}/evals/${kind}/${id}`;
}

export const evalsApi = {
	set: (u: string, g: string, kind: EvalSubjectKind, id: string) =>
		request<EvalSet>(base(u, g, kind, id)),

	addCase: (
		u: string,
		g: string,
		kind: EvalSubjectKind,
		id: string,
		data: EvalCaseWrite,
	) =>
		request<EvalCase>(`${base(u, g, kind, id)}/cases`, {
			method: "POST",
			body: JSON.stringify(data),
		}),

	/** Accept a proposed case (`status: active`), or edit one. */
	updateCase: (
		u: string,
		g: string,
		kind: EvalSubjectKind,
		id: string,
		caseId: string,
		data: Partial<EvalCaseWrite> & { status?: string },
	) =>
		request<EvalCase>(`${base(u, g, kind, id)}/cases/${caseId}`, {
			method: "PATCH",
			body: JSON.stringify(data),
		}),

	deleteCase: (
		u: string,
		g: string,
		kind: EvalSubjectKind,
		id: string,
		caseId: string,
	) =>
		request<void>(`${base(u, g, kind, id)}/cases/${caseId}`, {
			method: "DELETE",
		}),

	/** Up to five cases drafted from the instructions, each `proposed`. */
	propose: (u: string, g: string, kind: EvalSubjectKind, id: string) =>
		request<EvalCase[]>(`${base(u, g, kind, id)}/propose`, { method: "POST" }),

	runs: (u: string, g: string, kind: EvalSubjectKind, id: string) =>
		request<EvalRun[]>(`${base(u, g, kind, id)}/runs`),

	run: (
		u: string,
		g: string,
		kind: EvalSubjectKind,
		id: string,
		runId: string,
	) => request<EvalRun>(`${base(u, g, kind, id)}/runs/${runId}`),

	open: (
		u: string,
		g: string,
		kind: EvalSubjectKind,
		id: string,
		data: EvalRunOpen,
	) =>
		request<EvalRunOpened>(`${base(u, g, kind, id)}/runs`, {
			method: "POST",
			body: JSON.stringify(data),
		}),
};
