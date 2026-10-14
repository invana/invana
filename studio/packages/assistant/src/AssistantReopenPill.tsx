import { Button } from "@invana/ui";
import { Sparkles } from "lucide-react";

interface AssistantReopenPillProps {
	/** The open conversation's title — what reopening brings back. */
	title: string;
	onOpen: () => void;
}

/**
 * `Assistant · <session title>`, floating over the canvas while a conversation
 * is open and the assistant is closed.
 *
 * Closing the assistant gives the board the whole width; this is the way back
 * that sits where the eye already is, beside the header's `Assistant` button.
 * It reopens the same thread, because the open session is page state that
 * closing the region never touched. The host positions it over its canvas.
 */
export function AssistantReopenPill({
	title,
	onOpen,
}: AssistantReopenPillProps) {
	return (
		<Button
			variant="outline"
			size="sm"
			className="max-w-80 bg-card shadow-md"
			onClick={onOpen}
		>
			<Sparkles className="h-3.5 w-3.5 shrink-0 text-primary" />
			<span className="truncate">Assistant · {title || "New session"}</span>
		</Button>
	);
}
