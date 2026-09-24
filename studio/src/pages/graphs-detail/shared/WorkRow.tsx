/**
 * The row every work list uses (`Agents at Work` hi-fi, page 2).
 *
 * The Explorer's {@link ListRow} was built for sessions and canvases, where a
 * row is a name and a timestamp. A work row answers three questions at once —
 * *what is it, who has it, and what is it waiting on* — and the wireframes give
 * each of them its own slot:
 *
 * ```
 * ● List single-sourced parts and their suppliers        [in progress]
 *   (Supplier Analyst) · Execute 5/7 · 1 child
 * ```
 *
 * Two details are load-bearing rather than decorative:
 *
 * - **The dot pulses only while something is running.** Motion on a board means
 *   "this is moving right now"; a static amber dot means "this is stuck and
 *   waiting on you". Using one glyph for both would hide the difference that
 *   decides who acts next. The kit's `running` tone is that pulse — Studio does
 *   not own a second dot.
 * - **The status badge never hides on hover.** It is the column a board is
 *   scanned down, so it holds its place; per-row *actions* are the things that
 *   reveal, and they sit before it.
 */

import { DetailStatus } from "@/pages/graphs-detail/shared/DetailRows";
import type { Tone } from "@/pages/graphs-detail/shared/statusTone";
import { StatusDot, cn } from "@invana/ui";
import type { CSSProperties, ReactNode } from "react";

export function WorkRow({
	active,
	onClick,
	tone = "muted",
	live,
	indent = 0,
	title,
	subtitle,
	status,
	statusTone = "muted",
	actions,
	className,
}: {
	active?: boolean;
	onClick?: () => void;
	tone?: Tone;
	live?: boolean;
	/** A spawned child, a sub-task — drawn with the wireframes' `└` gutter. */
	indent?: number;
	title: ReactNode;
	subtitle?: ReactNode;
	status?: ReactNode;
	statusTone?: Tone;
	/** Hover-revealed controls, before the status badge. */
	actions?: ReactNode;
	className?: string;
}) {
	// The row's click target is a **sibling** of its actions, not their parent.
	// A `<button>` cannot contain a `<button>`: the markup is invalid, React says
	// so, and the browser is free to make the inner controls unreachable. So the
	// selecting click lives on its own button, which fills the row, and the
	// per-row actions sit beside it — the same shape the Explorer's `ListRow`
	// uses. The hover wash and the selected tint move to the wrapper, so the
	// whole row still lights up as one thing.
	const Target = onClick ? "button" : "div";
	return (
		<div
			className={cn(
				"group flex w-full items-start gap-2.5 pr-3",
				onClick && "hover:bg-accent/60",
				active && "bg-accent",
				className,
			)}
		>
			<Target
				type={onClick ? "button" : undefined}
				onClick={onClick}
				// The panel's `px-3`, plus 14px a level for a nested row.
				className={cn(
					"flex min-w-0 flex-1 items-start gap-2.5 py-2 pl-3 text-left",
					indent ? "ps-[calc(var(--spacing)*3+var(--row-indent))]" : null,
				)}
				style={
					indent
						? ({ "--row-indent": `${indent * 14}px` } as CSSProperties)
						: undefined
				}
			>
				{/* `running` is the kit's pulsing tone, which is the same rule this
				    row always had: motion means "moving right now", a static amber
				    dot means "stuck, waiting on you". */}
				<StatusDot tone={live ? "running" : tone} className="mt-1.5" />
				<span className="min-w-0 flex-1">
					<span className="flex items-center gap-1.5">
						{indent ? (
							<span className="shrink-0 text-muted-foreground" aria-hidden>
								└
							</span>
						) : null}
						<span className="truncate text-base text-foreground">{title}</span>
					</span>
					{subtitle ? (
						<span className="mt-0.5 flex min-w-0 items-center gap-1.5 text-base text-muted-foreground">
							{subtitle}
						</span>
					) : null}
				</span>
			</Target>
			{actions ? (
				<span className="flex shrink-0 items-center gap-0.5 py-2 opacity-0 transition-opacity group-hover:opacity-100">
					{actions}
				</span>
			) : null}
			{status ? (
				<span className="shrink-0 pt-2.5">
					<DetailStatus tone={statusTone}>{status}</DetailStatus>
				</span>
			) : null}
		</div>
	);
}
