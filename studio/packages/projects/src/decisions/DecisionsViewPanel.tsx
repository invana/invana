/**
 * Decisions — every decision across the Graph's projects, what it cited and
 * the rules it passed, in one place to audit (projects.md).
 *
 * The engine records no decisions yet: a decision is made on a project's
 * branch, and branches arrive with the engine's projects work. Until then the
 * panel draws the kit's `EmptyState` and says where a project's rules are read
 * today.
 */

import { EmptyState, EmptyStateLock } from "@invana/ui";
import { Gavel, Lock } from "lucide-react";

export function DecisionsViewPanel() {
	return (
		<EmptyState
			className="h-full"
			icon={<Gavel />}
			title="Decisions"
			description="Every decision across this Graph's projects — what it cited and the rules it passed — in one place to audit. Until then, a project's working rules are in its Details tab."
			locks={[
				<EmptyStateLock key="engine" icon={<Lock />}>
					Opens with engine support
				</EmptyStateLock>,
			]}
		/>
	);
}
