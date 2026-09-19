/**
 * The selected-element detail grammar (docs/for-developers/modules/explore/features/selection-and-the-panel.md).
 *
 * Four of the six canvas kinds show a detail that is **a statement of fact**,
 * not a disabled form — and the whole difference is in the container, not in a
 * `disabled` attribute:
 *
 * | Device | Why |
 * |---|---|
 * | **No containers on values.** `${steps.translate_a.query}` is bare mono text on a labelled row | on the Agent page, *editable* values sit in bordered chips. Keeping the border for editability and dropping it here puts the affordance in the container, not in a greyed-out state |
 * | **Bordered elements are statuses, never inputs** | the badge grammar (`seeded` · `promoted` · `pinned`) is one nobody reads as a control |
 * | **Prose completes the row** — "runs first — required order" | the Plan tab's `when done` row is the precedent: a sentence, not a field |
 * | **A pin is attributed, not locked** | a lock icon on a greyed field says *you can't*; naming the owners says *this belongs somewhere else*, which is both true and navigable |
 *
 * The one place this grammar is deliberately *replaced* rather than extended is
 * an editable object (an agent's envelope) — keeping the two visibly distinct
 * is what stops a read-only detail from reading as broken (docs/for-developers/modules/explore/features/selection-and-the-panel.md).
 */

import type { Tone } from "@/pages/graphs-detail/shared/statusTone";
import { AgentChip, Badge, PropertyList, cn } from "@invana/ui";
import type { ReactNode } from "react";

export function DetailBlock({
	title,
	subtitle,
	children,
	className,
}: {
	title: ReactNode;
	subtitle?: ReactNode;
	children: ReactNode;
	className?: string;
}) {
	return (
		// `mt-auto` bottom-pins it: the detail is the same slot on every kind,
		// which is what lets one inspector render N shapes (docs/for-developers/modules/explore/features/selection-and-the-panel.md).
		<div className={cn("mt-auto border-t px-3 py-2.5", className)}>
			<div className="mb-2">
				<div className="text-base font-medium text-foreground">{title}</div>
				{subtitle ? (
					<div className="text-sm text-muted-foreground">{subtitle}</div>
				) : null}
			</div>
			{/* `PropertyList` owns the label column, so every value in the block
			    starts on the same x — the reason to use it over a row of grids. */}
			<PropertyList labelWidth={110}>{children}</PropertyList>
		</div>
	);
}

/**
 * A sentence that completes the row rather than a value that fills a field.
 * `validate_a` *runs first — required order*.
 */
export function DetailProse({ children }: { children: ReactNode }) {
	return <span className="text-muted-foreground"> — {children}</span>;
}

/**
 * A status, and only ever a status. This is the sole bordered element in the
 * grammar, which is what keeps "bordered means editable" true everywhere else.
 */
export function DetailStatus({
	children,
	tone = "muted",
	className,
}: {
	children: ReactNode;
	tone?: Tone;
	className?: string;
}) {
	// The kit's `Badge` is the badge. What stays here is the *domain* half — the
	// one status vocabulary Tasks, Agents and steps share ({@link Tone}) mapped
	// onto the kit's two knobs. A tone that carries no state gets the outline
	// only, so a tint always means "this status is doing something", which is
	// the rule this grammar has always had.
	const variant =
		tone === "error"
			? "destructive"
			: tone === "muted" || tone === "queued"
				? "outline"
				: "soft";
	const badgeTone =
		tone === "running"
			? "info"
			: tone === "error" || tone === "queued"
				? undefined
				: tone;
	return (
		<Badge variant={variant} tone={badgeTone} size="xs" className={className}>
			{children}
		</Badge>
	);
}

/**
 * An agent chip. Plural by construction — which is the point: a pin lives on
 * one agent's envelope and a library entry is used by N, so the answer to
 * *whose* is a list, never a link to "the" agent (docs/for-developers/modules/explore/features/selection-and-the-panel.md, D4).
 */
export function AgentChipRow({
	agents,
	onOpen,
}: {
	agents: { id: string; name: string; status?: string }[];
	onOpen?: (id: string) => void;
}) {
	if (!agents.length) return null;
	return (
		<div className="flex flex-wrap gap-1">
			{agents.map((a) => (
				// The kit's `AgentChip` is "who did this, as a 22px chip" — identity,
				// deliberately not a `Badge`, because an agent is not a status. A
				// retired agent is struck through rather than toned, for the same
				// reason: it is still the same agent.
				<AgentChip
					key={a.id}
					name={a.name}
					onClick={onOpen ? () => onOpen(a.id) : undefined}
					title={onOpen ? `Open ${a.name}` : a.name}
					className={cn(
						onOpen && "cursor-pointer hover:text-primary",
						a.status === "retired" && "text-muted-foreground line-through",
					)}
				/>
			))}
		</div>
	);
}

/**
 * The empty state for the detail slot. Says what a click would do rather than
 * leaving a blank rectangle — on a read-only canvas, silence reads as broken.
 */
export function DetailPlaceholder({ hint }: { hint: string }) {
	return (
		<div className="mt-auto border-t px-3 py-3 text-sm text-muted-foreground">
			{hint}
		</div>
	);
}
