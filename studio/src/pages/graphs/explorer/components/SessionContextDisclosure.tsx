import { Button, ChatSessionDisclosure } from "@invana/ui";
import { Copy } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import type { SessionContextTurn } from "../../../../types/session";

export interface SessionContextDisclosureProps {
	/** The assistant reply whose context is shown. */
	messageId: string;
	/** This reply's own question (the preceding user prompt) — shown last so the
	 *  full exchange the model saw is self-contained. */
	prompt?: string;
	/** Fetch the prior turns the model was given (RFC-036/040). */
	onFetch: (messageId: string) => Promise<SessionContextTurn[]>;
	/** Collapse — the parent unmounts this block. */
	onClose: () => void;
}

/**
 * "What the model saw" for an NL reply (RFC-040), as a console disclosure under
 * the activity row (RFC-054). Mounted when the user opens context, so the
 * fetch happens once per open; the header meta reads "loading…" until the
 * turns land, then counts them.
 */
export function SessionContextDisclosure({
	messageId,
	prompt,
	onFetch,
	onClose,
}: SessionContextDisclosureProps) {
	// null = still loading. The parent remounts this block on every open, so a
	// once-per-mount fetch is exactly once per disclosure.
	const [turns, setTurns] = useState<SessionContextTurn[] | null>(null);

	// biome-ignore lint/correctness/useExhaustiveDependencies: fetch once per mount; callbacks are read at mount time
	useEffect(() => {
		let cancelled = false;
		onFetch(messageId)
			.then((t) => {
				if (!cancelled) setTurns(t);
			})
			.catch(() => {
				if (cancelled) return;
				toast.error("Couldn't load the context for this reply.");
				onClose();
			});
		return () => {
			cancelled = true;
		};
	}, [messageId]);

	// Copy the disclosed context as readable text — handy for debugging / issues.
	const copyContext = () => {
		const parts = (turns ?? []).map((t) =>
			t.query
				? `Asked: ${t.prompt}\nQuery: ${t.query}${
						t.rationale ? `\nWhy: ${t.rationale}` : ""
					}`
				: `Asked: ${t.prompt}\nClarified: ${t.question}`,
		);
		if (prompt) parts.push(`This question: ${prompt}`);
		navigator.clipboard?.writeText(parts.join("\n\n"));
		toast.success("Context copied to clipboard");
	};

	const meta =
		turns === null
			? "loading…"
			: turns.length > 0
				? `${turns.length} earlier turn${turns.length === 1 ? "" : "s"} + this question`
				: "this question only";

	return (
		<ChatSessionDisclosure
			label="context"
			meta={meta}
			open
			onOpenChange={(open) => {
				if (!open) onClose();
			}}
		>
			{turns === null ? (
				<span className="text-muted-foreground">Loading context…</span>
			) : (
				<div className="flex flex-col gap-3 text-muted-foreground">
					{turns.map((turn, i) => (
						<div
							// biome-ignore lint/suspicious/noArrayIndexKey: turns carry no id and the list is fixed once fetched
							key={`${messageId}-ctx-${i}`}
							className="flex flex-col gap-1.5 border-t border-border/60 pt-3 first:border-t-0 first:pt-0"
						>
							<ContextField label="Asked">{turn.prompt}</ContextField>
							{turn.query ? (
								<ContextField label="Query">
									<pre className="overflow-x-auto whitespace-pre-wrap break-words rounded-control bg-background/70 px-2 py-1.5 font-mono leading-relaxed text-foreground/80">
										{turn.query}
									</pre>
								</ContextField>
							) : (
								<ContextField label="Clarified">{turn.question}</ContextField>
							)}
							{turn.rationale && (
								<p className="whitespace-pre-wrap break-words italic leading-relaxed text-muted-foreground/80">
									{turn.rationale}
								</p>
							)}
						</div>
					))}
					{prompt && (
						<div
							className={
								turns.length > 0 ? "border-t border-border/60 pt-3" : undefined
							}
						>
							<ContextField label="This question" emphasis>
								{prompt}
							</ContextField>
						</div>
					)}
					<div className="flex justify-end">
						<Button
							variant="ghost"
							size="sm"
							className="h-6 gap-1 px-2 text-muted-foreground"
							onClick={copyContext}
						>
							<Copy className="h-3 w-3" />
							Copy context
						</Button>
					</div>
				</div>
			)}
		</ChatSessionDisclosure>
	);
}

/** A labelled field inside the context block — "Asked", "Query", … */
function ContextField({
	label,
	emphasis,
	children,
}: {
	label: string;
	emphasis?: boolean;
	children: React.ReactNode;
}) {
	return (
		<div className="flex flex-col gap-0.5">
			<span
				className={`uppercase tracking-wide ${
					emphasis
						? "font-medium text-foreground/70"
						: "text-muted-foreground/60"
				}`}
			>
				{label}
			</span>
			{typeof children === "string" ? (
				<p className="whitespace-pre-wrap break-words text-foreground/90">
					{children}
				</p>
			) : (
				children
			)}
		</div>
	);
}
