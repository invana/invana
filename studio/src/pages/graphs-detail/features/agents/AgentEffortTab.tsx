/**
 * Thinking — the agent's focus and its effort (AG23).
 *
 * No default stance yet: it ships with stances themselves, and until they are
 * rows with an author and a version this tab carries focus and effort only
 * (AG27). Effort is `agents.effort`, edited here and nowhere else (EB9).
 */

import { CeilingsTable } from "@/pages/graphs-detail/features/agents/CeilingsTable";
import type { AgentDraft } from "@/pages/graphs-detail/features/agents/agentDraft";
import type { Agent } from "@/types/work";
import { PanelSection } from "@/ui/PanelSection";
import { Textarea } from "@invana/forms";

export function AgentEffortTab({
	agent,
	draft,
	onPatch,
}: {
	agent: Agent;
	draft: AgentDraft;
	onPatch: (next: Partial<AgentDraft>) => void;
}) {
	// Focus beside effort, as drawn; the stance takes the second column when
	// stances ship (AG27 · AG38).
	return (
		<div className="grid items-start gap-2.5 p-3.5 @[760px]:grid-cols-2">
			<PanelSection card title="Focus" hint="after the Graph's instructions">
				<Textarea
					aria-label="Focus"
					value={draft.instructions}
					onChange={(e) => onPatch({ instructions: e.target.value })}
					rows={5}
					placeholder="What this agent is for, and which path through the graph it should prefer."
				/>
			</PanelSection>

			<PanelSection card title="Effort">
				{/* The placeholder is what a run reads where this agent is silent —
				    the default, or a number still carried on the old columns (EB11). */}
				<CeilingsTable
					group="effort"
					values={draft.effort}
					effective={agent.effective_effort}
					onChange={(effort) => onPatch({ effort })}
				/>
			</PanelSection>
		</div>
	);
}
