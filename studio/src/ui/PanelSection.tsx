import { SectionHeader } from "@invana/ui";
import type { ReactNode } from "react";

/**
 * A labelled block inside a panel — `Brief`, `Bindings`, `Budget`, `Policy`.
 *
 * The kit's `SectionHeader` is the bar that titles it, and `action` is its
 * `actions`. What this adds is the body's padding, the rule between sections,
 * and the one thing the kit's `count` slot cannot do: carry a **sentence**
 * beside the title without erasing it (see below). Eighteen call sites agree on
 * all three.
 *
 * **Kit candidate.** No Invana noun in the props, so by the design rules a
 * `SectionHeader` that also takes a body belongs in `@invana/ui`. Tracked in
 * `docs/for-developers/building-studio/design-kit-coverage.md`.
 */
export function PanelSection({
	title,
	hint,
	action,
	children,
}: {
	title: ReactNode;
	hint?: ReactNode;
	action?: ReactNode;
	children: ReactNode;
}) {
	return (
		<section className="border-b last:border-b-0">
			<SectionHeader
				// The hint rides **inside** the title slot rather than in `count`.
				// `SectionHeader` gives `count` `shrink-0` and the title
				// `flex-1 truncate` — right for the short fact the slot is named
				// for (`3 pinned`), and wrong for the sentences these sections
				// actually carry: a sentence took the whole row and truncated the
				// title to nothing, so `The flow it draws` rendered as no
				// characters at all. Here the title never shrinks and the hint
				// truncates, which is the order a reader needs them in.
				title={
					<span className="flex min-w-0 items-baseline gap-2">
						<span className="shrink-0">{title}</span>
						{hint != null ? (
							<span className="min-w-0 truncate font-normal text-sm text-muted-foreground">
								{hint}
							</span>
						) : null}
					</span>
				}
				actions={action}
				bare
			/>
			<div className="px-3 pb-2.5">{children}</div>
		</section>
	);
}
