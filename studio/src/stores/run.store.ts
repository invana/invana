// Live run state (docs/for-developers/modules/ask/features/streaming-and-the-workflow.md). One view per run, folded from its
// stream by `apply` — the only place emissions are interpreted. Settled
// replies read their steps from the session detail; this store is for what's
// moving right now (and keeps the reasoning / diagnosis / result that only
// ride the stream, so they stay visible after the reply settles).

import { stepFromFrame } from "@/services/api/runs";
import type { Emission } from "@/types/emission";
import type { QueryResponse } from "@/types/query";
import type {
	AskFrame,
	Diagnosis,
	QueryProposed,
	RunNode,
	RunStatus,
	RunView,
} from "@/types/run";
import { create } from "zustand";

interface ThinkingState {
	views: Record<string, RunView>;
	/** Register a run before its stream opens (or from a session detail). */
	seed: (
		view: Pick<RunView, "id" | "sessionId" | "messageId"> & Partial<RunView>,
	) => void;
	apply: (runId: string, e: AskFrame) => void;
	remove: (runId: string) => void;
}

function upsertStep(steps: RunNode[], step: RunNode): RunNode[] {
	const idx = steps.findIndex((s) => s.id === step.id);
	const next =
		idx === -1
			? [...steps, step]
			: steps.map((s, i) => (i === idx ? { ...s, ...step } : s));
	return next.sort((a, b) => a.seq - b.seq || a.attempt - b.attempt);
}

function fold(view: RunView, e: AskFrame): RunView {
	const p = e.payload;
	const v: RunView = { ...view, seq: Math.max(view.seq, e.seq) };
	switch (e.kind) {
		case "run.started":
			return {
				...v,
				status: "run",
				workflow: (p.workflow as string | undefined) ?? v.workflow,
			};
		case "step.started":
		case "step.needs_input":
		case "step.finished":
			return { ...v, steps: upsertStep(v.steps, stepFromFrame(p)) };
		case "step.retrying": {
			const step = stepFromFrame(p);
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
		case "emission": {
			// Emissions paint as they arrive rather than at the end of the run
			// (SW1). They are re-read from the record once it settles (AS10);
			// this is the live copy, and the seq keeps their order.
			const arriving = p as unknown as {
				id: string;
				seq: number;
				kind: string;
				payload: Record<string, unknown>;
				citation: Record<string, unknown>;
			};
			const existing = v.emissions ?? [];
			const emission = foldEmission(arriving);
			return {
				...v,
				emissions: [
					...existing.filter((e) => e.id !== emission.id),
					emission,
				].sort((a, b) => a.seq - b.seq),
			};
		}
		case "cannot_answer":
			// Not a diagnosis: the graph is telling you what it does not hold,
			// which is an answer (CA1). Rendering it beside "the graph timed out"
			// would put two different things in one shape.
			return {
				...v,
				cannotAnswer: {
					reason: String(p.reason ?? ""),
					stage: p.stage ? String(p.stage) : undefined,
				},
			};
		case "diagnosis":
			return { ...v, diagnosis: p as unknown as Diagnosis };
		case "run.done":
			return {
				...v,
				status: (p.status as RunStatus) ?? "succeeded",
				outcome: p.outcome ? String(p.outcome) : undefined,
			};
		case "run.cancelled":
			return { ...v, status: "cancelled" };
		default:
			return v;
	}
}

/**
 * One arriving emission frame, as the card reads it.
 *
 * The kind comes off the frame — the producing step declared it (AS2) — so this
 * never inspects the payload to decide what it is looking at.
 */
function foldEmission(frame: {
	id: string;
	seq: number;
	kind: string;
	payload: Record<string, unknown>;
	citation: Record<string, unknown>;
	templates?: unknown[];
}): Emission {
	const p = frame.payload as Record<string, never>;
	const base = {
		id: frame.id,
		seq: frame.seq,
		citation: {
			recordCount: Number(frame.citation?.record_count ?? 0),
			query: (frame.citation?.query as string | undefined) ?? undefined,
		},
		templates: ((frame.templates ?? []) as Record<string, never>[]).map(
			(t) => ({
				templateId: String(t.template_id),
				name: String(t.name),
				surface: String(t.surface),
				version: Number(t.version ?? 1),
				available: Boolean(t.available),
				reason: (t.reason as string | null) ?? null,
			}),
		),
	};
	switch (frame.kind) {
		case "subgraph":
			return {
				...base,
				kind: "subgraph",
				data: p.data as never,
				onCanvas: Boolean(p.on_canvas),
			};
		case "metric":
			return {
				...base,
				kind: "metric",
				value: String(p.value ?? "—"),
				label: p.label as string | undefined,
			};
		case "chart":
			return {
				...base,
				kind: "chart",
				caption: p.caption as string | undefined,
				series: (p.series ?? []) as never,
			};
		case "prose":
			return { ...base, kind: "prose", text: String(p.text ?? "") };
		case "empty":
			return { ...base, kind: "empty", statement: String(p.statement ?? "") };
		default:
			return { ...base, kind: "table", rows: (p.rows ?? []) as never };
	}
}

/** A view's resting state. A function, not a constant — `steps` is mutable, and
 *  one shared array across every run would be a cross-talk bug. */
function freshView(): Pick<RunView, "status" | "steps" | "seq"> {
	return { status: "queued", steps: [], seq: 0 };
}

export const useRunStore = create<ThinkingState>((set) => ({
	views: {},
	seed: (view) =>
		set((state) => ({
			views: {
				...state.views,
				[view.id]: {
					// Defaults, then whatever is already known, then the seed —
					// each layer only fills what the one after it leaves out.
					// Spread rather than written inline: keys before a spread that
					// may carry them are silently overwritten (TS2783).
					...freshView(),
					...state.views[view.id],
					...view,
				},
			},
		})),
	apply: (runId, e) =>
		set((state) => {
			const current = state.views[runId];
			if (!current || e.seq <= current.seq) return state;
			return { views: { ...state.views, [runId]: fold(current, e) } };
		}),
	remove: (runId) =>
		set((state) => {
			const { [runId]: _dropped, ...rest } = state.views;
			return { views: rest };
		}),
}));

/** Steps of the queued plan a run shows before its stream arrives. */
export function seedSteps(steps: RunNode[]): RunNode[] {
	return [...steps].sort((a, b) => a.seq - b.seq || a.attempt - b.attempt);
}
