/**
 * Agents › Settings — how much may run at once, pool by pool (agents.md).
 *
 * A budget bounds one agent; this bounds the Graph: the database its agents
 * query and the provider behind them. The fields and the live pool counts are
 * `ConcurrencyFields`, under a section header like every other panel's.
 */

import { SectionHeader } from "@invana/ui";
import { PanelStatusBar, StatusCrumb } from "@invana-studio/ui";
import { ConcurrencyFields } from "./ConcurrencyFields";

interface Props {
	username: string;
	graphSlug: string;
}

export function AgentsSettingsViewPanel({ username, graphSlug }: Props) {
	return (
		<div className="flex h-full min-h-0 flex-col">
			<SectionHeader title="Concurrency" />
			<div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
				<ConcurrencyFields username={username} graphSlug={graphSlug} />
			</div>
			<PanelStatusBar
				left={<StatusCrumb active>Settings</StatusCrumb>}
				right="bounds the whole Graph"
			/>
		</div>
	);
}
