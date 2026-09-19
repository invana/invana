import { SectionHeader } from "@invana/ui";
import type { ReactNode } from "react";

/**
 * A labelled block inside a panel — `Brief`, `Bindings`, `Budget`, `Policy`.
 *
 * The kit's `SectionHeader` is the bar that titles it: `hint` is its `count`
 * slot — "a fact about the section", which is what a hint like `3 pinned` is —
 * and `action` is its `actions`. What this adds is the body's padding and the
 * rule between sections, so eighteen call sites agree on both.
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
			<SectionHeader title={title} count={hint} actions={action} bare />
			<div className="px-3 pb-2.5">{children}</div>
		</section>
	);
}
