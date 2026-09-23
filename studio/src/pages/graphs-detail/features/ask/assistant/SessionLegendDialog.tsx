import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@invana/ui";

interface LegendEntry {
	swatchClassName: string;
	label: string;
	description: string;
}

// Mirrors the status → color mapping in SessionTurn.tsx (ChatSessionActivityRow)
// and SessionSteps.tsx / AssistantPanel.tsx (ChatSessionTaskRow), which both draw
// from @invana/ui's shared `bg-info` / `bg-success` / `bg-warning` /
// `bg-destructive` / `bg-primary` tokens.
const ENTRIES: LegendEntry[] = [
	{
		swatchClassName: "bg-primary",
		label: "Your message",
		description: "The prompt you sent, marked with a chevron.",
	},
	{
		swatchClassName: "bg-success",
		label: "Answered",
		description: "The assistant's reply, or a step that finished successfully.",
	},
	{
		swatchClassName: "bg-info",
		label: "Clarifying question",
		description: "The assistant is asking you something before it continues.",
	},
	{
		swatchClassName: "bg-warning",
		label: "Needs input",
		description:
			"A step (e.g. “Understand”) is paused, waiting on your input, or was interrupted.",
	},
	{
		swatchClassName: "bg-destructive",
		label: "Failed",
		description: "The reply or step errored out.",
	},
	{
		swatchClassName: "bg-primary animate-pulse motion-reduce:animate-none",
		label: "Running",
		description: "A step is currently executing.",
	},
	{
		swatchClassName: "bg-transparent ring-1 ring-muted-foreground/40",
		label: "Queued",
		description: "A step hasn't started yet.",
	},
];

interface SessionLegendDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

/**
 * Explains the colored dots/chevrons used throughout the session transcript
 * (turns, steps, and the live-activity strip) — surfaced from the Sessions
 * panel header's help icon.
 */
export function SessionLegendDialog({
	open,
	onOpenChange,
}: SessionLegendDialogProps) {
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>Session status legend</DialogTitle>
				</DialogHeader>
				<ul className="flex flex-col gap-3 py-1">
					{ENTRIES.map((entry) => (
						<li key={entry.label} className="flex items-start gap-3">
							<span
								className={`mt-1 size-2.5 shrink-0 rounded-full ${entry.swatchClassName}`}
								aria-hidden
							/>
							<span className="min-w-0">
								<span className="block text-base font-medium text-foreground">
									{entry.label}
								</span>
								<span className="block text-base text-muted-foreground">
									{entry.description}
								</span>
							</span>
						</li>
					))}
				</ul>
			</DialogContent>
		</Dialog>
	);
}
