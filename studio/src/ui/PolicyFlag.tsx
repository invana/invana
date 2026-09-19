import { cn } from "@invana/ui";
import { Check, X } from "lucide-react";

/**
 * `spawn ✓` / `unattended ✗` / `assignable —` — an agent policy read at a glance.
 *
 * **Three states, not two.** An agent's `policy` is a sparse dict: a key that is
 * absent means *the graph default applies*, which is a different fact from
 * *explicitly denied*. Rendering an unset key as `✗` would tell a reader this
 * agent has been forbidden something nobody ever decided about — and then a Save
 * would write that invention back as a real denial. The dash says "inherited",
 * the same way an empty budget field does.
 *
 * This one stays in Studio: the tri-state is Invana's agent-policy rule, not a
 * markup shape, which is what `src/ui/` is for (code-shape.md §4 · DS2).
 */
export function PolicyFlag({
	label,
	on,
	onToggle,
}: {
	label: string;
	/** `undefined` = not set on this agent; the graph default applies. */
	on: boolean | undefined;
	onToggle?: (next: boolean | undefined) => void;
}) {
	const body = (
		<>
			<span className="text-muted-foreground">{label}</span>
			{on === undefined ? (
				<span className="text-muted-foreground" title="not set — graph default">
					—
				</span>
			) : on ? (
				<Check className="h-3 w-3 text-success" aria-label="allowed" />
			) : (
				<X className="h-3 w-3 text-muted-foreground" aria-label="not allowed" />
			)}
		</>
	);
	const className =
		"inline-flex items-center gap-1.5 rounded-sm border px-2 py-1 text-xs";
	if (!onToggle) return <span className={className}>{body}</span>;
	return (
		<button
			type="button"
			// Cycles rather than toggles, because the third state has to be
			// reachable: a person who set a flag by accident needs a way back to
			// "let the graph decide", and clearing it is not the same as denying it.
			onClick={() => onToggle(on === undefined ? true : on ? false : undefined)}
			title={
				on === undefined
					? "Not set — click to allow"
					: on
						? "Allowed — click to deny"
						: "Denied — click to clear"
			}
			className={cn(className, "hover:border-primary/40")}
		>
			{body}
		</button>
	);
}
