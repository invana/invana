import { cn } from "@invana/ui";
import type { HTMLAttributes, ReactNode } from "react";

/**
 * **Temporary mirror of `Eyebrow` in `@invana/ui`.**
 *
 * The component is built and exported in `design-kit`
 * (`packages/ui/src/components/ui-extended/eyebrow.tsx`, with its story); Studio
 * pins `@invana/ui@^0.0.24`, which predates it. On the next kit release this
 * file is **deleted** and the import becomes `import { Eyebrow } from
 * "@invana/ui"` — the props are identical, so nothing else changes.
 *
 * It lives here rather than as six copies of `text-meta font-semibold uppercase
 * tracking-wide` across the wizard, which is the drift the kit component exists
 * to stop.
 */
export interface EyebrowProps extends HTMLAttributes<HTMLDivElement> {
	/** Right-aligned trailing text — a count, a position, a state. */
	aside?: ReactNode;
	tone?: "muted" | "foreground" | "accent";
	children?: ReactNode;
}

export function Eyebrow({
	aside,
	tone = "muted",
	className,
	children,
	...props
}: EyebrowProps) {
	return (
		<div
			className={cn(
				"flex items-baseline gap-2 text-meta font-semibold uppercase tracking-wide",
				tone === "muted" && "text-muted-foreground",
				tone === "foreground" && "text-foreground",
				tone === "accent" && "text-primary",
				className,
			)}
			{...props}
		>
			<span className="min-w-0 truncate">{children}</span>
			{aside != null ? (
				<span className="ml-auto shrink-0 font-normal normal-case tracking-normal text-muted-foreground">
					{aside}
				</span>
			) : null}
		</div>
	);
}
