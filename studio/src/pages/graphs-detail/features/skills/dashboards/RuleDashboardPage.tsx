/**
 * The rule board, as a page — artboard `RuleDash`
 * ([34t](../../../../../../docs/for-developers/the-screens.md)).
 *
 * The rule itself comes from the Graph's list — one read the drawer has
 * already made — and the counts from its citations, which is the one read only
 * this page needs ([RU11](../../../../../../docs/for-developers/modules/skills/features/rules.md)).
 */

import {
	useRuleCitationsQuery,
	useRulesQuery,
} from "@/hooks/queries/useSkills";
import { useReport } from "@/pages/graphs-detail/features/boards";
import { ruleDashboardSpec } from "@/pages/graphs-detail/features/skills/dashboards/ruleDashboardSpec";
import { SKILL_ACTIONS } from "@/pages/graphs-detail/features/skills/dashboards/shared";
import { DASHBOARD_ICONS } from "@/pages/graphs-detail/shared/dashboardIcons";
import { VIEW_DASHBOARD } from "@/pages/graphs-detail/shared/dashboardSpec";
import { Dashboard } from "@invana/dashboard";
import { EmptyState, Spinner } from "@invana/ui";
import { useMemo, useState } from "react";

export interface RuleDashboardPageProps {
	username: string;
	graphSlug: string;
	/** The `rules.id` every panel binds to. */
	ruleId: string;
	/** `Edit` — puts the Rules drawer back on this rule, drilled in. */
	onEdit: (ruleId: string) => void;
	/** A citation row — opens the run the citing step came from. */
	onOpenRun?: (runId: string) => void;
}

export function RuleDashboardPage({
	username,
	graphSlug,
	ruleId,
	onEdit,
	onOpenRun,
}: RuleDashboardPageProps) {
	const rules = useRulesQuery(username, graphSlug);
	const rule = rules.data?.items.find((r) => r.id === ruleId) ?? null;
	const citations = useRuleCitationsQuery(username, graphSlug, ruleId);
	const [view, setView] = useState(VIEW_DASHBOARD);

	const spec = useMemo(
		() => (rule ? ruleDashboardSpec(rule, citations.data, { view }) : null),
		[rule, citations.data, view],
	);

	// `Save report` on the header, and the act behind it (B6). The document
	// it keeps is `spec` — this page's reading, resolved — never the subject.
	const report = useReport(spec);

	if (rules.isLoading) {
		return (
			<div className="flex h-full items-center justify-center">
				<Spinner />
			</div>
		);
	}
	if (!rule || !spec || !report) {
		return (
			<EmptyState
				className="h-full"
				title="This rule is gone"
				description="A rule has no delete — it is deactivated — so this one was removed with its Graph or its project."
			/>
		);
	}

	return (
		<Dashboard
			className="h-full min-h-0 overflow-y-auto p-3"
			spec={report.spec}
			icons={DASHBOARD_ICONS}
			onAction={(id, ctx) => {
				if (report.handle(id)) return;
				switch (id) {
					case SKILL_ACTIONS.view:
						if (ctx?.option) setView(ctx.option);
						return;
					case SKILL_ACTIONS.edit:
						onEdit(ruleId);
						return;
					case SKILL_ACTIONS.openRun: {
						// A citation row is a **step** — two steps of one run cite the
						// rule twice — so it carries the step's id, and the run comes
						// from the document the page drew.
						const cited = citations.data?.items.find(
							(c) => c.step_id === ctx?.itemId,
						);
						if (cited?.run_id) onOpenRun?.(cited.run_id);
						return;
					}
					default:
						return;
				}
			}}
		/>
	);
}
