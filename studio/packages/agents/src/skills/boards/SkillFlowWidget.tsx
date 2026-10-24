/**
 * The `skillFlow` panel kind — kept for **reports**. `skill:<id>` is the
 * skill's page, not a board, so nothing live composes this panel; a reading
 * saved from the retired skill board still names it, and a frozen document
 * renders whatever it names.
 */

import type { PanelRendererProps } from "@invana/boards";
import { EmptyState, Spinner } from "@invana/ui";
import { PlanFlow } from "../SkillFlowTab";
import type { SkillPlaybookRead } from "../types";

export interface SkillFlowOptions {
	plan: SkillPlaybookRead | null;
	loading: boolean;
	/** What the band says when the skill has no published version to draw. */
	empty?: { title: string; description: string };
}

export function SkillFlowWidget({
	options,
}: PanelRendererProps<SkillFlowOptions>) {
	if (options.loading) return <Spinner />;
	if (!options.plan)
		return (
			<EmptyState
				title={options.empty?.title ?? "No plan to draw"}
				description={options.empty?.description}
			/>
		);
	return (
		<div className="h-80">
			<PlanFlow plan={options.plan} />
		</div>
	);
}
