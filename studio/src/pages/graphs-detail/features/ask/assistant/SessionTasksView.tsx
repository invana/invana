import {
	type StepClarification,
	StepList,
	totalDuration,
} from "@/pages/graphs-detail/features/ask/assistant/SessionSteps";
import { useRunStore } from "@/stores/run.store";
import type { RunNode, RunView } from "@/types/run";
import {
	type Session,
	type SessionMessage,
	isClarification,
} from "@/types/session";
import { ChatSession, ChatSessionTaskGroup } from "@invana/ui";
import { useMemo } from "react";

export interface SessionTasksViewProps {
	session: Session;
	/** Jump back to the chat, scrolled to the reply. */
	onJump: (messageId: string) => void;
}

interface Turn {
	message: SessionMessage;
	prompt: string;
	steps: RunNode[];
	/** A step can be asked back more than once, so the value is the rounds —
	 *  same shape `Timeline` produces and `StepList` consumes. */
	clarifications: Map<string, StepClarification[]>;
	view?: RunView;
}

/**
 * Steps for a reply: the live view while it runs, the record afterwards.
 *
 * A run that pauses for a clarification resumes under a **new** reply
 * (docs/for-developers/modules/ask/features/streaming-and-the-workflow.md), so one live view spans two replies — the question and the
 * answered run. A reply shows only the attempts that ran under it (the record
 * is already scoped that way by `RunNode.message_id`); without the filter
 * both replies would list the whole run and one turn would read as two.
 */
export function stepsFor(
	message: SessionMessage,
	view: RunView | undefined,
): RunNode[] {
	if (view && view.steps.length > 0) {
		const mine = view.steps.filter((s) => s.messageId === message.id);
		if (mine.length > 0) return mine;
		// Frames that carry no reply id belong to the run's current reply.
		const unowned = view.steps.filter((s) => !s.messageId);
		if (unowned.length > 0 && view.messageId === message.id) return unowned;
	}
	return message.steps ?? [];
}

export interface Timeline {
	steps: RunNode[];
	/** Clarifying rounds to nest under their step, keyed by step id — see
	 *  `StepList`'s `clarifications` prop. */
	clarifications: Map<string, StepClarification[]>;
}

/**
 * The full, auditable timeline for the run `message` belongs to: every step
 * across a paused-then-resumed ask (docs/for-developers/modules/ask/features/streaming-and-the-workflow.md) as one continuous list, with
 * the step that paused carrying its question — and, once answered, the answer
 * — instead of the pause and its resume showing up as two "Understand" rows.
 * Mirrors the reference mock's `resume()`, which mutates a single turn in
 * place rather than starting a second one.
 *
 * A run may pause **several times** (the model asking one thing after another
 * to pin the question down). Each round is one ask-reply + the user message
 * that answered it, all on the same run, so they read as one step that
 * asked repeatedly: every round hangs under the surviving attempt of the step
 * that asked, in the order asked, rather than stacking up a fresh step row per
 * round.
 */
export function timelineFor(
	messages: SessionMessage[],
	message: SessionMessage,
	view: RunView | undefined,
): Timeline {
	const chain = message.runId
		? messages.filter(
				(m) => m.role === "assistant" && m.runId === message.runId,
			)
		: [message];

	const steps: RunNode[] = [];
	const asked: StepClarification[] = [];
	const last = chain[chain.length - 1];
	const awaiting = !!last && isClarification(last);

	chain.forEach((m, ci) => {
		const mySteps = stepsFor(m, view);
		if (!isClarification(m)) {
			steps.push(...mySteps);
			return;
		}
		// This message's run paused here; the answer (once resumed) is the
		// very next message in the session — the option clicked, or what the
		// user typed instead.
		const askIdx = messages.indexOf(m);
		const answerMsg = messages[askIdx + 1];
		asked.push({
			question: m.content,
			options: m.clarificationOptions ?? [],
			answer: answerMsg?.role === "user" ? answerMsg.content : undefined,
		});
		// Still awaiting: keep the paused step, live. Resolved: only that last
		// step is superseded by the re-attempt at the top of the next reply —
		// anything that had already run under this reply stays on the record.
		steps.push(...(ci === chain.length - 1 ? mySteps : mySteps.slice(0, -1)));
	});

	const clarifications = new Map<string, StepClarification[]>();
	// Every round hangs under one row: the step still waiting, or — once
	// resolved — the attempt that finally got through.
	const anchor = awaiting
		? steps[steps.length - 1]
		: (stepsFor(last ?? message, view)[0] ?? steps[0]);
	if (anchor && asked.length > 0) clarifications.set(anchor.id, asked);

	return { steps, clarifications };
}

function turnState(turn: Turn): string {
	const s = turn.view?.status;
	if (s === "queued" || s === "run") return "running";
	if (s === "awaiting_input" || isClarification(turn.message))
		return "waiting on you";
	if (turn.message.status === "error") return "failed";
	if (turn.message.status === "stopped") return "stopped";
	const ms = totalDuration(turn.steps);
	return ms > 0 ? `${(ms / 1000).toFixed(1)}s` : "";
}

/**
 * Every step of every reply in the session, grouped by turn, in the order they
 * happened (docs/for-developers/modules/ask/features/streaming-and-the-workflow.md): oldest at the top, the latest turn at the bottom —
 * the same reading direction as the chat thread, so switching tabs doesn't flip
 * the timeline. Turns still running or waiting sink to the bottom, where the
 * view is parked; a row click jumps to the reply in the chat.
 */
export function SessionTasksView({ session, onJump }: SessionTasksViewProps) {
	const views = useRunStore((s) => s.views);

	const turns = useMemo<Turn[]>(() => {
		const out: Turn[] = [];
		// A reply that resumes an earlier clarified ask (docs/for-developers/modules/ask/features/streaming-and-the-workflow.md) folds into
		// that ask's group instead of starting a second one headed by the
		// mid-run answer — one run is one row, its steps one continuous
		// timeline, no matter how many times it paused for input.
		const seenThinking = new Set<string>();
		session.messages.forEach((m, i) => {
			if (m.role !== "assistant") return;
			if (m.runId) {
				if (seenThinking.has(m.runId)) return;
				seenThinking.add(m.runId);
			}
			const view = m.runId ? views[m.runId] : undefined;
			const { steps, clarifications } = timelineFor(session.messages, m, view);
			if (steps.length === 0) return;
			// The run's latest reply drives status and the jump target.
			const latest = m.runId
				? [...session.messages]
						.reverse()
						.find((x) => x.role === "assistant" && x.runId === m.runId)
				: m;
			const prev = session.messages[i - 1];
			out.push({
				message: latest ?? m,
				prompt: prev?.role === "user" ? prev.content : m.content,
				steps,
				clarifications,
				view,
			});
		});
		// Settled turns first, then the ones still needing you, then the ones
		// still running — so live work sits at the bottom edge the view follows.
		const weight = (t: Turn) =>
			t.view?.status === "queued" || t.view?.status === "run"
				? 2
				: t.view?.status === "awaiting_input"
					? 1
					: 0;
		return out.sort((a, b) => weight(a) - weight(b));
	}, [session.messages, views]);

	if (turns.length === 0) {
		return (
			<div className="flex flex-col items-center justify-center gap-2 px-6 py-16 text-muted-foreground">
				<p className="text-center">
					No tasks yet. Every reply's steps show up here as it thinks.
				</p>
			</div>
		);
	}

	return (
		// Same scroll surface as the thread: parked at the bottom on the latest
		// turn, following live growth only while the user is already down there.
		// Radix's viewport wraps children in a `display:table` div that defeats
		// `truncate` in the headings, so force it back to `block`.
		<ChatSession
			className="[&_[data-radix-scroll-area-viewport]>div]:!block"
			autoScrollKey={`${session.id}:${turns.length}`}
		>
			{turns.map((t) => (
				<ChatSessionTaskGroup
					key={t.message.id}
					heading={
						<div className="flex items-baseline justify-between gap-2">
							<span className="min-w-0 truncate font-medium" title={t.prompt}>
								{t.prompt}
							</span>
							<span className="shrink-0 font-mono text-sm font-normal text-muted-foreground">
								{t.message.createdAt.toLocaleTimeString([], {
									hour: "2-digit",
									minute: "2-digit",
								})}
								{turnState(t) ? ` · ${turnState(t)}` : ""}
							</span>
						</div>
					}
				>
					<StepList
						steps={t.steps}
						clarifications={t.clarifications}
						onOpenTrace={() => onJump(t.message.id)}
					/>
				</ChatSessionTaskGroup>
			))}
		</ChatSession>
	);
}
