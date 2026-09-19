import { Button, cn } from "@invana/ui";
import {
	type CSSProperties,
	type HTMLAttributes,
	type ReactNode,
	useLayoutEffect,
	useRef,
	useState,
} from "react";

/**
 * **Temporary mirror of `ClampedText` in `@invana/ui`.**
 *
 * The component is built and exported in `design-kit`
 * (`packages/ui/src/components/ui-extended/clamped-text.tsx`, with its story);
 * Studio pins `@invana/ui@^0.0.24`, which predates it. On the next kit release
 * this file is **deleted** and the import becomes `import { ClampedText } from
 * "@invana/ui"` — the props are identical, so nothing else changes.
 *
 * Prose that shows its first few lines and offers the rest *in place*: a
 * project's purpose above a list of Todos, where the first sentence is what the
 * panel is for and the full paragraph would push the list off the screen
 * ([PT9](../../../docs/for-developers/modules/work/features/projects-and-tasks.md)).
 */
export interface ClampedTextProps
	extends Omit<HTMLAttributes<HTMLDivElement>, "children"> {
	/** How many lines survive before the fold. Three is the panel default. */
	lines?: number;
	moreLabel?: string;
	lessLabel?: string;
	children?: ReactNode;
}

export function ClampedText({
	lines = 3,
	moreLabel = "Show more",
	lessLabel = "Show less",
	className,
	children,
	...props
}: ClampedTextProps) {
	const [expanded, setExpanded] = useState(false);
	const [clipped, setClipped] = useState(false);
	const bodyRef = useRef<HTMLParagraphElement>(null);

	// The toggle only exists when there is something behind it, and that is
	// measured rather than guessed from a character count: three lines in a
	// narrow panel is one line in a wide one, and a `Show more` that reveals
	// nothing teaches the reader to stop pressing it. Only measured while
	// clamped — expanded, `scrollHeight === clientHeight` by definition, and
	// measuring there would retract the button that got you here.
	// biome-ignore lint/correctness/useExhaustiveDependencies: children/lines are trigger-only — the measurement reads the live element, and new text at the same width still has to be re-measured
	useLayoutEffect(() => {
		const el = bodyRef.current;
		if (!el || expanded) return;
		const measure = () => setClipped(el.scrollHeight - el.clientHeight > 1);
		measure();
		const observer = new ResizeObserver(measure);
		observer.observe(el);
		return () => observer.disconnect();
	}, [expanded, children, lines]);

	return (
		<div className={cn("min-w-0", className)} {...props}>
			<p
				ref={bodyRef}
				className={cn(
					"whitespace-pre-line",
					!expanded &&
						"overflow-hidden [-webkit-box-orient:vertical] [-webkit-line-clamp:var(--clamped-lines)] [display:-webkit-box]",
				)}
				style={{ "--clamped-lines": lines } as CSSProperties}
			>
				{children}
			</p>
			{clipped ? (
				<Button
					type="button"
					variant="link"
					size="sm"
					className="h-auto p-0"
					aria-expanded={expanded}
					onClick={() => setExpanded((open) => !open)}
				>
					{expanded ? lessLabel : moreLabel}
				</Button>
			) : null}
		</div>
	);
}
