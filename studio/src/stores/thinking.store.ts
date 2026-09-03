// Live thinking state (RFC-055 § 9.4). One view per thinking, folded from its
// stream by `apply` — the only place emissions are interpreted. Settled
// replies read their steps from the session detail; this store is for what's
// moving right now (and keeps the reasoning / diagnosis / result that only
// ride the stream, so they stay visible after the reply settles).

import { create } from "zustand";
import { stepFromEmission } from "../services/api/thinkings";
import type { QueryResponse } from "../types/query";
import type {
	Diagnosis,
	Emission,
	QueryProposed,
	ThinkingStatus,
	ThinkingStep,
	ThinkingView,
} from "../types/thinking";

interface ThinkingState {
	views: Record<string, ThinkingView>;
	/** Register a thinking before its stream opens (or from a session detail). */
	seed: (
		view: Pick<ThinkingView, "id" | "sessionId" | "messageId"> &
			Partial<ThinkingView>,
	) => void;
	apply: (thinkingId: string, e: Emission) => void;
	remove: (thinkingId: string) => void;
}

function upsertStep(steps: ThinkingStep[], step: ThinkingStep): ThinkingStep[] {
	const idx = steps.findIndex((s) => s.id === step.id);
	const next =
		idx === -1
			? [...steps, step]
			: steps.map((s, i) => (i === idx ? { ...s, ...step } : s));
	return next.sort((a, b) => a.seq - b.seq || a.attempt - b.attempt);
}

function fold(view: ThinkingView, e: Emission): ThinkingView {
	const p = e.payload;
	const v: ThinkingView = { ...view, seq: Math.max(view.seq, e.seq) };
	switch (e.kind) {
		case "thinking.started":
			return {
				...v,
				status: "thinking",
				workflow: (p.workflow as string | undefined) ?? v.workflow,
			};
		case "step.started":
		case "step.needs_input":
		case "step.finished":
			return { ...v, steps: upsertStep(v.steps, stepFromEmission(p)) };
		case "step.retrying": {
			const step = stepFromEmission(p);
			step.retryReason = p.reason as string | undefined;
			return { ...v, steps: upsertStep(v.steps, step) };
		}
		case "step.progress":
			return {
				...v,
				steps: v.steps.map((s) =>
					s.id === p.step_id ? { ...s, detail: String(p.detail ?? "") } : s,
				),
			};
		case "reasoning":
			return { ...v, reasoning: String(p.text ?? "") };
		case "query.proposed":
			return { ...v, query: p as unknown as QueryProposed };
		case "clarification.requested":
			return {
				...v,
				status: "awaiting_input",
				clarification: {
					question: String(p.question ?? ""),
					options: (p.options as string[] | undefined) ?? [],
				},
			};
		case "result":
			return { ...v, result: p.result as QueryResponse };
		case "diagnosis":
			return { ...v, diagnosis: p as unknown as Diagnosis };
		case "thinking.done":
			return { ...v, status: (p.status as ThinkingStatus) ?? "succeeded" };
		case "thinking.cancelled":
			return { ...v, status: "cancelled" };
		default:
			return v;
	}
}

export const useThinkingStore = create<ThinkingState>((set) => ({
	views: {},
	seed: (view) =>
		set((state) => ({
			views: {
				...state.views,
				[view.id]: {
					status: "queued",
					steps: [],
					seq: 0,
					...state.views[view.id],
					...view,
				},
			},
		})),
	apply: (thinkingId, e) =>
		set((state) => {
			const current = state.views[thinkingId];
			if (!current || e.seq <= current.seq) return state;
			return { views: { ...state.views, [thinkingId]: fold(current, e) } };
		}),
	remove: (thinkingId) =>
		set((state) => {
			const { [thinkingId]: _dropped, ...rest } = state.views;
			return { views: rest };
		}),
}));

/** Steps of the queued plan a thinking shows before its stream arrives. */
export function seedSteps(steps: ThinkingStep[]): ThinkingStep[] {
	return [...steps].sort((a, b) => a.seq - b.seq || a.attempt - b.attempt);
}
