import { cn } from "@invana/ui";
import type { HTMLAttributes } from "react";

/**
 * The board's empty ground — the dotted surface a canvas draws on, for the
 * screens that stand where a canvas will be: the Explorer's centred start,
 * its lock, and the empty board behind a docked chat. Fills its parent and
 * centres what it holds.
 */
export function BoardGround({
	className,
	...props
}: HTMLAttributes<HTMLDivElement>) {
	return (
		<div
			className={cn(
				"flex h-full w-full flex-col items-center justify-center overflow-auto bg-background bg-[radial-gradient(color-mix(in_srgb,var(--color-muted-foreground)_22%,transparent)_1px,transparent_1px)] bg-size-[16px_16px]",
				className,
			)}
			{...props}
		/>
	);
}
