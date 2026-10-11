/**
 * Overview — what broke, what waits, what slowed down and what changed
 * recently, across the Graph's agents (agents.md).
 *
 * Nothing summarises the fleet yet, so the panel draws the kit's `EmptyState`
 * and points at where each answer lives today: a run that broke or waits is in
 * Activity › Runs, and each agent's own activity is on its page.
 */

import { EmptyState, EmptyStateLock } from "@invana/ui";
import { LayoutGrid, Lock } from "lucide-react";

export function OverviewViewPanel() {
	return (
		<EmptyState
			className="h-full"
			icon={<LayoutGrid />}
			title="Overview"
			description="What broke, what is waiting, what slowed down and what changed — one place to tend agents before anyone notices. Until then, runs that broke or wait are in Activity › Runs."
			locks={[
				<EmptyStateLock key="engine" icon={<Lock />}>
					Opens with engine support
				</EmptyStateLock>,
			]}
		/>
	);
}
