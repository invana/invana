import { ChatSessionTaskGroup, ScrollArea } from "@invana/ui";
import { useMemo } from "react";
import { useThinkingStore } from "../../../../stores/thinking.store";
import type { Session, SessionMessage } from "../../../../types/session";
import type { ThinkingStep, ThinkingView } from "../../../../types/thinking";
import { StepList, totalDuration } from "./SessionSteps";

export interface SessionTasksViewProps {
	session: Session;
	/** Jump back to the chat, scrolled to the reply. */
	onJump: (messageId: string) => void;
}

interface Turn {
	message: SessionMessage;
	prompt: string;
	steps: ThinkingStep[];
	view?: ThinkingView;
}

/** Steps for a reply: the live view while it runs, the record afterwards. */
export function stepsFor(
	message: SessionMessage,
	view: ThinkingView | undefined,
): ThinkingStep[] {
	if (view && view.steps.length > 0) return view.steps;
	return message.steps ?? [];
}

function turnState(turn: Turn): string {
	const s = turn.view?.status;
	if (s === "queued" || s === "thinking") return "running";
	if (s === "awaiting_input" || turn.message.clarificationOptions)
		return "waiting on you";
	if (turn.message.status === "error") return "failed";
	if (turn.message.status === "stopped") return "stopped";
	const ms = totalDuration(turn.steps);
	return ms > 0 ? `${(ms / 1000).toFixed(1)}s` : "";
}

/**
 * Every step of every reply in the session, grouped by turn, newest first
 * (RFC-055 UC11). Turns still running or waiting float to the top; a row click
 * jumps to the reply in the chat.
 */
export function SessionTasksView({ session, onJump }: SessionTasksViewProps) {
	const views = useThinkingStore((s) => s.views);

	const turns = useMemo<Turn[]>(() => {
		const out: Turn[] = [];
		session.messages.forEach((m, i) => {
			if (m.role !== "assistant") return;
			const view = m.thinkingId ? views[m.thinkingId] : undefined;
			const steps = stepsFor(m, view);
			if (steps.length === 0) return;
			const prev = session.messages[i - 1];
			out.push({
				message: m,
				prompt: prev?.role === "user" ? prev.content : m.content,
				steps,
				view,
			});
		});
		const weight = (t: Turn) =>
			t.view?.status === "queued" || t.view?.status === "thinking"
				? 0
				: t.view?.status === "awaiting_input"
					? 1
					: 2;
		return out.reverse().sort((a, b) => weight(a) - weight(b));
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
		<ScrollArea className="h-full min-h-0 [&_[data-radix-scroll-area-viewport]>div]:!block">
			<div className="flex flex-col gap-4 p-3">
				{turns.map((t) => (
					<ChatSessionTaskGroup
						key={t.message.id}
						heading={
							<div className="flex items-baseline justify-between gap-2">
								<span className="min-w-0 truncate font-medium" title={t.prompt}>
									{t.prompt}
								</span>
								<span className="shrink-0 font-mono text-[12px] font-normal text-muted-foreground">
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
							onOpenTrace={() => onJump(t.message.id)}
						/>
					</ChatSessionTaskGroup>
				))}
			</div>
		</ScrollArea>
	);
}
