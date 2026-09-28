/**
 * The `skillFlow` panel kind — kept for **reports**. `skill:<id>` is now the
 * skill's page, not a board (SK36), so nothing live composes this panel; a
 * reading saved from the retired skill board still names it, and a frozen
 * document renders whatever it names ([B16](../../../../../../docs/for-developers/building-engine/boards-migration.md)).
 */

import { SkillFlowTab } from "@/pages/graphs-detail/features/skills/SkillFlowTab";
import type { SkillPlanRead } from "@/types/skills";
import type { PanelRendererProps } from "@invana/dashboard";

export interface SkillFlowOptions {
	plan: SkillPlanRead | null;
	loading: boolean;
	/** What the band says when the skill has no published version to draw. */
	empty?: { title: string; description: string };
}

/** The registry entry this panel registers under, for the spec's type argument. */
export type WithSkillFlow = { skillFlow: SkillFlowOptions };

export function SkillFlowWidget({
	options,
}: PanelRendererProps<SkillFlowOptions>) {
	return (
		<SkillFlowTab
			plan={options.plan ?? undefined}
			loading={options.loading}
			empty={options.empty}
		/>
	);
}
