/**
 * Performance — speed, success and tokens per agent and skill, and an alert
 * when one degrades (agents.md).
 *
 * The engine keeps no baselines yet, so the panel draws the kit's `EmptyState`
 * naming what opens it — never an empty chart.
 */

import { EmptyState, EmptyStateLock } from "@invana/ui";
import { Gauge, Lock } from "lucide-react";

export function PerformanceViewPanel() {
	return (
		<EmptyState
			className="h-full"
			icon={<Gauge />}
			title="Performance"
			description="Speed, success and tokens for each agent and skill, against its own baseline — and an alert naming the change that came before a slowdown."
			locks={[
				<EmptyStateLock key="engine" icon={<Lock />}>
					Opens with engine support
				</EmptyStateLock>,
			]}
		/>
	);
}
