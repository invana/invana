import { Badge } from "@invana/ui";
import type { ReactNode } from "react";

/**
 * A `PanelStack` drawer's title: the section's name, and the count of what is
 * inside it.
 *
 * The count lives here rather than in `headerActions` because those are quiet
 * until the header is hovered, and a count has to read while the drawer is
 * closed — that is most of what a closed drawer is for (model-editor.md ME13).
 *
 * A `PanelStack` styles a string title itself; a node is rendered as-is, so the
 * kit's own header typography is repeated here deliberately.
 */
export function SectionTitle({
	children,
	count,
}: {
	children: ReactNode;
	/** Omitted means "no count to show", which is not the same as zero (ME14). */
	count?: number;
}) {
	return (
		<span className="flex min-w-0 items-center gap-2">
			<span className="truncate text-meta font-semibold uppercase tracking-wide">
				{children}
			</span>
			{count != null && (
				<Badge variant="secondary" className="rounded-full px-1.5 py-0">
					{count}
				</Badge>
			)}
		</span>
	);
}
