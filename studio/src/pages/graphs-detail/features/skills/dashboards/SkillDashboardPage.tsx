/**
 * The skill board, as a page — artboard `SkillDash`
 * ([34r](../../../../../../docs/for-developers/the-screens.md)).
 *
 * Opened by `More` on the drilled-in Skills drawer, which **stays where it
 * was**: a skill is a setting that hangs over the work, so reading one in full
 * never costs the panel you opened it from
 * ([SK36](../../../../../../docs/for-developers/modules/skills/features/authoring-a-skill.md)).
 *
 * It reads what the drawer reads — the same five queries, the same cache — so
 * opening the board paints from what the drawer already fetched rather than
 * asking the engine the same questions again.
 */

import {
	useSkillAgentsQuery,
	useSkillPlanQuery,
	useSkillUsageQuery,
	useSkillVersionsQuery,
	useSkillsQuery,
} from "@/hooks/queries/useSkills";
import { useReport } from "@/pages/graphs-detail/features/boards";
import { SkillFlowPanel } from "@/pages/graphs-detail/features/skills/dashboards/SkillFlowPanel";
import { SKILL_ACTIONS } from "@/pages/graphs-detail/features/skills/dashboards/shared";
import {
	type SkillPanels,
	skillDashboardSpec,
} from "@/pages/graphs-detail/features/skills/dashboards/skillDashboardSpec";
import { DASHBOARD_ICONS } from "@/pages/graphs-detail/shared/dashboardIcons";
import { VIEW_DASHBOARD } from "@/pages/graphs-detail/shared/dashboardSpec";
import { Dashboard } from "@invana/dashboard";
import { EmptyState, Spinner } from "@invana/ui";
import { useMemo, useState } from "react";

export interface SkillDashboardPageProps {
	username: string;
	graphSlug: string;
	/** The `skills.id` every panel binds to. */
	skillId: string;
	/** `Usage…` — opens `skill_usage:<id>` as its own page. */
	onOpenUsage: (skillId: string) => void;
	/** A Bindings row — opens that agent where agents live. */
	onOpenAgent?: (agentId: string) => void;
	/** `Edit` — puts the drawer back on this skill, drilled in. */
	onEdit: (skillId: string) => void;
}

export function SkillDashboardPage({
	username,
	graphSlug,
	skillId,
	onOpenUsage,
	onOpenAgent,
	onEdit,
}: SkillDashboardPageProps) {
	const skills = useSkillsQuery(username, graphSlug);
	const skill = skills.data?.items.find((s) => s.id === skillId) ?? null;
	// A draft's plan hangs off its own version and is read inside the Playbook
	// tab; the board draws the **current** version — what a step is offered
	// today (SK5).
	const plan = useSkillPlanQuery(
		username,
		graphSlug,
		skillId,
		skill && !skill.is_draft ? skill.version : null,
	);
	const versions = useSkillVersionsQuery(username, graphSlug, skillId);
	const agents = useSkillAgentsQuery(username, graphSlug, skillId);
	const usage = useSkillUsageQuery(username, graphSlug, skillId);
	const [view, setView] = useState(VIEW_DASHBOARD);

	const spec = useMemo(
		() =>
			skill
				? skillDashboardSpec(
						{
							skill,
							plan: plan.data,
							planLoading: plan.isLoading,
							versions: versions.data?.items ?? [],
							agents: agents.data?.items ?? [],
							usage: usage.data,
						},
						{ view },
					)
				: null,
		[
			skill,
			plan.data,
			plan.isLoading,
			versions.data,
			agents.data,
			usage.data,
			view,
		],
	);

	// `Save report` on the header, and the act behind it (B6). The document
	// it keeps is `spec` — this page's reading, resolved — never the subject.
	const report = useReport(spec);

	if (skills.isLoading) {
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
				description="It may have been deleted since this page was opened. The versions a step was offered still resolve in its trace."
			/>
		);
	}

	return (
		<Dashboard<SkillPanels>
			className="h-full min-h-0 overflow-y-auto p-3"
			spec={report.spec}
			// Skills' own strip, mounted rather than redrawn: the drawer and the
			// board would otherwise be two drawings of one plan (SK16).
			registry={{ skillFlow: SkillFlowPanel }}
			icons={DASHBOARD_ICONS}
			onAction={(id, ctx) => {
				if (report.handle(id)) return;
				switch (id) {
					case SKILL_ACTIONS.view:
						if (ctx?.option) setView(ctx.option);
						return;
					case SKILL_ACTIONS.openUsage:
						onOpenUsage(skillId);
						return;
					case SKILL_ACTIONS.edit:
						onEdit(skillId);
						return;
					case SKILL_ACTIONS.openAgent:
						if (ctx?.itemId) onOpenAgent?.(ctx.itemId);
						return;
					default:
						return;
				}
			}}
		/>
	);
}
