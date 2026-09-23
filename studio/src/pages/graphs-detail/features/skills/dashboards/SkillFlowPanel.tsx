/**
 * The skill board's flow band — the Flow tab, mounted as a dashboard panel.
 *
 * A registry entry rather than a built-in kind, for the reason
 * `@invana/dashboard` states about `canvas`: the package carries **strings** in
 * the spec and takes renderers as a prop, so a panel that needs a component the
 * package has never heard of arrives from the consumer. Here the component is
 * Skills' own `SkillFlowTab` — the board **hosts** the layer strip, it does not
 * own what a band means
 * ([SK16](../../../../../../docs/for-developers/modules/skills/features/authoring-a-skill.md)).
 *
 * Reusing the tab rather than drawing a second strip is the whole point: the
 * drawer and the board would otherwise be two drawings of one plan to keep in
 * step, which is the argument SK16 already made against a node graph.
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

export function SkillFlowPanel({
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
