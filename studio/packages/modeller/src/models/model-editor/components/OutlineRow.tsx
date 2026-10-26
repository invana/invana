import { cn, StatusDot } from "@invana/ui";
import type { Tone } from "@invana-studio/ui";
import type { ReactNode } from "react";

/**
 * One line of a model's outline — a dot, the name, and what it is beside it.
 *
 * ```
 * ● airport  staged                                     14 props
 * ● route                                      airport → airport
 * ```
 *
 * The outline is read down, not into: a type's detail is its own page, so a
 * row carries only what tells two rows apart. Hover-revealed `actions` sit
 * after the meta.
 */
export function OutlineRow({
	name,
	meta,
	tone = "muted",
	chip,
	active,
	onClick,
	actions,
}: {
	name: ReactNode;
	meta?: ReactNode;
	tone?: Tone;
	/** A mark beside the name — `staged`. */
	chip?: ReactNode;
	active?: boolean;
	onClick?: () => void;
	actions?: ReactNode;
}) {
	const Target = onClick ? "button" : "div";
	return (
		<div
			className={cn(
				"group flex w-full items-center gap-2 pr-3",
				onClick && "hover:bg-accent/60",
				active && "bg-accent",
			)}
		>
			<Target
				type={onClick ? "button" : undefined}
				onClick={onClick}
				className="flex min-w-0 flex-1 items-center gap-2 py-1 pl-3 text-left"
			>
				<StatusDot tone={tone} />
				<span className="min-w-0 truncate font-mono">{name}</span>
				{chip}
				{meta ? (
					<span className="ml-auto shrink-0 pl-2 text-sm text-muted-foreground">
						{meta}
					</span>
				) : null}
			</Target>
			{actions ? (
				<span className="flex shrink-0 items-center opacity-0 transition-opacity group-hover:opacity-100">
					{actions}
				</span>
			) : null}
		</div>
	);
}
