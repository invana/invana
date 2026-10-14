import type { RunNode, RunView } from "@invana-studio/core";
import { isClarification, type SessionMessage } from "@invana-studio/core";
import type { StepClarification } from "./SessionSteps";

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
