import { Button, Kbd } from "@invana/ui";
import { Star } from "lucide-react";

const IS_MAC =
	typeof navigator !== "undefined" &&
	/Mac|iP(hone|ad)/.test(navigator.platform);

interface AssistantReopenPillProps {
	/** The open conversation's title — what reopening brings back. */
	title: string;
	onOpen: () => void;
	/**
	 * What the page in front is about. Given, the pill reads
	 * *Ask about <ask>* with the ⌘J that opens the assistant, instead of the
	 * open conversation's title.
	 */
	ask?: string;
}

/**
 * `Assistant · <session title>`, floating over the canvas while a conversation
 * is open and the assistant is closed.
 *
 * Closing the assistant gives the board the whole width; this is the way back
 * that sits where the eye already is, beside the header's `Assistant` button.
 * It reopens the same thread, because the open session is page state that
 * closing the region never touched. The host positions it over its canvas.
 *
 * Over a page that is not a conversation's canvas (an Agents section), the
 * pill names the page instead — `Ask about Fleet ⌘J` — since there is no
 * thread in front to bring back.
 */
export function AssistantReopenPill({
	title,
	onOpen,
	ask,
}: AssistantReopenPillProps) {
	return (
		<Button
			variant="outline"
			size="sm"
			className="max-w-80 bg-card shadow-md"
			onClick={onOpen}
		>
			<Star className="h-3.5 w-3.5 shrink-0 text-primary" />
			{ask ? (
				<>
					<span className="truncate">Ask about {ask}</span>
					<Kbd>{IS_MAC ? "⌘J" : "Ctrl J"}</Kbd>
				</>
			) : (
				<span className="truncate">Assistant · {title || "New session"}</span>
			)}
		</Button>
	);
}
