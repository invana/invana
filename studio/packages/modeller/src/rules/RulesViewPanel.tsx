/**
 * Rules — the Modeller's `leftSection` panel for a Graph's invariants
 * (modeller.md).
 *
 * A stack of one section with no panel header above it: the section header is
 * the top of the column, and the breadcrumb already says which panel is open.
 * A rule is offered to a step and cited by it, never enforced, and the status
 * bar says so.
 */

import { PanelStack } from "@invana/ui";
import { PanelStatusBar, StatusCrumb } from "@invana-studio/ui";
import { useRulesSection } from "./useRulesSection";

export function RulesViewPanel({
	username,
	graphSlug,
	onOpenRuleBoard,
}: {
	username: string;
	graphSlug: string;
	/** `Open this rule as a page` — the rule's board in `mainSection`. */
	onOpenRuleBoard?: (ruleId: string) => void;
}) {
	const rules = useRulesSection({ username, graphSlug, onOpenRuleBoard });
	return (
		<div className="flex h-full min-h-0 flex-col">
			<div className="min-h-0 flex-1">
				<PanelStack sections={[rules]} withHandle />
			</div>
			<PanelStatusBar
				left={<StatusCrumb active>Rules</StatusCrumb>}
				right="offered and cited, never enforced"
			/>
		</div>
	);
}
