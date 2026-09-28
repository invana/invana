/**
 * The plan page — `plan_runs:<plan_id>` in `BoardPagesViewPanel`
 * ([LB24](../../../../../../../docs/for-developers/modules/workflows/features/the-library.md)).
 *
 * It fetches and answers actions. It composes nothing: `planBoardSpec`
 * builds the document and `@invana/dashboard` draws it. The window, the tab,
 * the picked step and the Activity filters are this page's reading — held
 * here, never in the URL, because a link to a plan is a link to the plan.
 */

import {
	usePlanPerformanceQuery,
	usePlanRunsQuery,
	usePlanVersionQuery,
	useWorkflowsQuery,
} from "@/hooks/queries/useWork";
import { useReport } from "@/pages/graphs-detail/features/boards";
import { PLAN_CHART_WIDGETS } from "@/pages/graphs-detail/features/plans/boards/PlanChartWidgets";
import {
	ALL,
	PLAN_ACTIONS,
	type PlanPanels,
	type PlanReading,
	type PlanTab,
	type PlanView,
	WINDOWS,
	planBoardSpec,
} from "@/pages/graphs-detail/features/plans/boards/planBoardSpec";
import { DASHBOARD_ICONS } from "@/pages/graphs-detail/shared/dashboardIcons";
import { TaskFlowWidget } from "@/pages/graphs-detail/shared/dashboards/TaskFlowWidget";
import { Dashboard, type DashboardSpec, RUN_PANELS } from "@invana/dashboard";
import { EmptyState, Spinner } from "@invana/ui";
import { useMemo, useState } from "react";

const REGISTRY = {
	layers: RUN_PANELS.layers,
	flow: TaskFlowWidget,
	...PLAN_CHART_WIDGETS,
};

export function PlanBoardPage({
	username,
	graphSlug,
	planId,
	onOpenRun,
	onOpenReading,
}: {
	username: string;
	graphSlug: string;
	/** The `task_plans.id` the board is keyed by. */
	planId: string;
	onOpenRun: (runId: string) => void;
	/** `⋯` — a reading of the version the header names, as its own page (LB38). */
	onOpenReading: (reading: PlanReading, planId: string) => void;
}) {
	const library = useWorkflowsQuery(username, graphSlug);
	const opened = library.data?.items.find((p) => p.id === planId);
	const key = opened?.key ?? undefined;
	const versions = useMemo(
		() =>
			(library.data?.items ?? [])
				.filter((p) => p.key === key)
				.map((p) => p.version)
				.sort((a, b) => a - b),
		[library.data, key],
	);

	const [picked, setPicked] = useState<number | null>(null);
	const version = picked ?? opened?.version;
	const [view, setView] = useState<PlanView>({
		tab: "overview",
		window: "30d",
		step: null,
		status: ALL,
		calledBy: ALL,
		agent: ALL,
	});

	const plan = usePlanVersionQuery(username, graphSlug, key, version);
	const performance = usePlanPerformanceQuery(
		username,
		graphSlug,
		key,
		version ? { version, window: view.window } : undefined,
	);
	const runs = usePlanRunsQuery(
		username,
		graphSlug,
		key,
		version
			? {
					version,
					window: view.window,
					status: view.status === ALL ? undefined : view.status,
					calledBy: view.calledBy === ALL ? undefined : view.calledBy,
					agentId: view.agent === ALL ? undefined : view.agent,
				}
			: undefined,
	);

	const spec = useMemo((): DashboardSpec<PlanPanels> | null => {
		if (!plan.data) return null;
		return planBoardSpec(
			{
				plan: plan.data,
				versions,
				performance: performance.data,
				runs: runs.data?.pages,
			},
			view,
		);
	}, [plan.data, versions, performance.data, runs.data, view]);

	// `Save report` on the header, and the act behind it (LB39 · B6). What it
	// keeps is this reading — the version, window and tab — resolved.
	const report = useReport(spec);

	if (library.isLoading || plan.isLoading)
		return (
			<div className="flex h-full items-center justify-center">
				<Spinner />
			</div>
		);
	if (!opened || !spec || !report)
		return (
			<EmptyState
				className="h-full"
				title="This plan is not in the library"
				description="It may have been retired. Close this page, or pick a plan in Library › Plans."
			/>
		);

	const set = (patch: Partial<PlanView>) =>
		setView((v) => ({ ...v, ...patch }));

	return (
		<Dashboard
			className="h-full min-h-0"
			spec={report.spec}
			registry={REGISTRY}
			icons={DASHBOARD_ICONS}
			onAction={(id, ctx) => {
				if (report.handle(id)) return;
				switch (id) {
					case PLAN_ACTIONS.tab:
						if (ctx?.option) set({ tab: ctx.option as PlanTab });
						return;
					case PLAN_ACTIONS.window:
						if (ctx?.option && WINDOWS[ctx.option])
							set({ window: WINDOWS[ctx.option], step: null });
						return;
					case PLAN_ACTIONS.version:
						if (ctx?.option) {
							setPicked(Number(ctx.option.slice(1)));
							set({ step: null });
						}
						return;
					case PLAN_ACTIONS.selectStep:
						// Picking the picked step again puts the card away.
						set({
							step: ctx?.itemId === view.step ? null : (ctx?.itemId ?? null),
						});
						return;
					case PLAN_ACTIONS.openRun:
						if (ctx?.itemId) onOpenRun(ctx.itemId);
						return;
					case PLAN_ACTIONS.status:
						if (ctx?.option) set({ status: ctx.option });
						return;
					case PLAN_ACTIONS.calledBy:
						if (ctx?.option) set({ calledBy: ctx.option });
						return;
					case PLAN_ACTIONS.agent:
						if (ctx?.option) set({ agent: ctx.option });
						return;
					case PLAN_ACTIONS.reading: {
						const shown = library.data?.items.find(
							(p) => p.key === key && p.version === version,
						);
						if (ctx?.option && shown)
							onOpenReading(ctx.option as PlanReading, shown.id);
						return;
					}
					case PLAN_ACTIONS.more:
						void runs.fetchNextPage();
						return;
					default:
						return;
				}
			}}
		/>
	);
}
