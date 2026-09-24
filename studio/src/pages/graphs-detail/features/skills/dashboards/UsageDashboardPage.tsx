/**
 * The usage board, as a page — artboard `UsageDash`
 * ([34s](../../../../../../docs/for-developers/the-screens.md)).
 *
 * One read, one document. The version picked in the header is **state on the
 * page, not an address**: every published version comes back in the same
 * response, so moving between them redraws rather than opening a tab
 * ([US7](../../../../../../docs/for-developers/modules/skills/features/usage.md)).
 */

import { useSkillUsageQuery, useSkillsQuery } from "@/hooks/queries/useSkills";
import { useReport } from "@/pages/graphs-detail/features/boards";
import { SKILL_ACTIONS } from "@/pages/graphs-detail/features/skills/dashboards/shared";
import { usageDashboardSpec } from "@/pages/graphs-detail/features/skills/dashboards/usageDashboardSpec";
import { DASHBOARD_ICONS } from "@/pages/graphs-detail/shared/dashboardIcons";
import { VIEW_DASHBOARD } from "@/pages/graphs-detail/shared/dashboardSpec";
import { Dashboard } from "@invana/dashboard";
import { EmptyState, Spinner } from "@invana/ui";
import { useMemo, useState } from "react";

export interface UsageDashboardPageProps {
	username: string;
	graphSlug: string;
	/** The `skills.id` this is a reading of. */
	skillId: string;
	/** `The skill` — back to what the numbers are about. */
	onOpenSkill: (skillId: string) => void;
	/** A step row — opens the run that step came from (C6). */
	onOpenRun?: (runId: string) => void;
}

export function UsageDashboardPage({
	username,
	graphSlug,
	skillId,
	onOpenSkill,
	onOpenRun,
}: UsageDashboardPageProps) {
	const skills = useSkillsQuery(username, graphSlug);
	const skill = skills.data?.items.find((s) => s.id === skillId) ?? null;
	const usage = useSkillUsageQuery(username, graphSlug, skillId);
	const [view, setView] = useState(VIEW_DASHBOARD);
	const [version, setVersion] = useState<number | null>(null);

	const spec = useMemo(
		() =>
			skill && usage.data
				? usageDashboardSpec(skill, usage.data, { view, version })
				: null,
		[skill, usage.data, view, version],
	);

	// `Save report` on the header, and the act behind it (B6). The document
	// it keeps is `spec` — this page's reading, resolved — never the subject.
	const report = useReport(spec);

	if (skills.isLoading || usage.isLoading) {
		return (
			<div className="flex h-full items-center justify-center">
				<Spinner />
			</div>
		);
	}
	if (!skill || !spec || !report) {
		return (
			<EmptyState
				className="h-full"
				title="This skill is gone"
				description="Its counts were derived from the record rather than stored, so there is nothing left to read."
			/>
		);
	}

	return (
		<Dashboard
			className="h-full min-h-0"
			spec={report.spec}
			icons={DASHBOARD_ICONS}
			onAction={(id, ctx) => {
				if (report.handle(id)) return;
				switch (id) {
					case SKILL_ACTIONS.view:
						if (ctx?.option) setView(ctx.option);
						return;
					case SKILL_ACTIONS.version:
						// `v7` → 7. The segmented action carries the label it drew.
						if (ctx?.option)
							setVersion(Number.parseInt(ctx.option.replace(/^v/, ""), 10));
						return;
					case SKILL_ACTIONS.openSkill:
						onOpenSkill(skillId);
						return;
					case SKILL_ACTIONS.openRun: {
						// The row is a **step**, so it carries a step's id; the run it
						// came from is read back out of the document the page drew.
						// Two steps of one run are two rows, which is why the id is
						// not the run's.
						const step = usage.data?.recent_steps.find(
							(s) => s.step_id === ctx?.itemId,
						);
						if (step?.run_id) onOpenRun?.(step.run_id);
						return;
					}
					default:
						return;
				}
			}}
		/>
	);
}
