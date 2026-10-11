import { AgentChip } from "@invana/ui";
import { Bot, User } from "lucide-react";
import type { ReactNode } from "react";

/**
 * A principal on a row — an agent or a person — on the kit's `AgentChip`.
 *
 * The two are drawn differently on purpose: agents are tinted and people are
 * left neutral, because "who is this waiting on?" is the question a board is
 * scanned for, and *agent vs human* is the answer that changes what you do next.
 * The glyph is the point, not decoration: on a scanned board the icon reads
 * before the name does.
 *
 * **Kit candidate, with one gap.** `AgentChip` carries the whole look — this
 * only maps Studio's `user` to its `person` and `muted` to its `inactive`. What
 * it cannot do is be pressed: it is a `<span>`, so a clickable principal needs a
 * real `<button>` around it or the keyboard cannot reach it. An `asChild` (or a
 * `button` render) on `AgentChip` would retire this file. Tracked in
 * `docs/for-developers/building-studio/design-kit-coverage.md`.
 */
export function PrincipalChip({
	name,
	kind = "user",
	muted,
	onClick,
	title,
}: {
	name: ReactNode;
	kind?: "agent" | "user" | null;
	muted?: boolean;
	onClick?: () => void;
	title?: string;
}) {
	const chip = (
		<AgentChip
			kind={kind === "agent" ? "agent" : "person"}
			inactive={muted}
			icon={kind === "agent" ? <Bot /> : <User />}
			name={name}
			title={onClick ? undefined : title}
		/>
	);
	if (!onClick) return chip;
	return (
		<button
			type="button"
			onClick={onClick}
			title={title}
			className="rounded-control focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring hover:ring-1 hover:ring-primary/40"
		>
			{chip}
		</button>
	);
}
