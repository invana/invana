/**
 * A step dashboard, as a page — artboards **D2 · D3 · D4**.
 *
 * Reached by clicking a task on the run dashboard's flow, breadcrumbed
 * `run / task`, with `‹ ›` to the task before and after
 * ([SR18](../../../../../../docs/for-developers/modules/operate/features/see-what-ran.md) ·
 * [CV15](../../../../../../docs/for-developers/modules/explore/features/boards.md)).
 *
 * It reads the **run's** trace, not a step endpoint: a step dashboard needs its
 * neighbours for `‹ ›` and its run for the crumb, and both live in the document
 * the run dashboard already fetched — so opening a task from the flow paints
 * from cache.
 */

import { DASHBOARD_ICONS } from "@/pages/graphs-detail/features/operate/dashboards/icons";
import { VIEW_DASHBOARD } from "@/pages/graphs-detail/features/operate/dashboards/shared";
import {
	STEP_ACTIONS,
	stepContext,
	stepDashboardSpec,
} from "@/pages/graphs-detail/features/operate/dashboards/stepDashboardSpec";
import { useRunTrace } from "@/pages/graphs-detail/features/operate/dashboards/useRunTrace";
import { Dashboard } from "@invana/dashboard";
import { EmptyState, Spinner } from "@invana/ui";
import { useMemo, useState } from "react";

export interface StepDashboardPageProps {
	username: string;
	graphSlug: string;
	/** The run this task ran in — the first crumb, and the document it reads. */
	runId: string;
	/** The `task_runs.id` of one attempt of the task. */
	stepId: string;
	/** `‹ ›` — the task before and after, in the same run. */
	onOpenStep: (stepId: string) => void;
}

export function StepDashboardPage({
	username,
	graphSlug,
	runId,
	stepId,
	onOpenStep,
}: StepDashboardPageProps) {
	const trace = useRunTrace(username, graphSlug, runId);
	const [view, setView] = useState(VIEW_DASHBOARD);

	const context = useMemo(
		() => (trace.data ? stepContext(trace.data, stepId) : null),
		[trace.data, stepId],
	);
	const spec = useMemo(
		() =>
			trace.data && context
				? stepDashboardSpec(trace.data, context, { view })
				: null,
		[trace.data, context, view],
	);

	if (trace.isLoading) {
		return (
			<div className="flex h-full items-center justify-center">
				<Spinner />
			</div>
		);
	}
	if (!trace.data || !context || !spec) {
		return (
			<EmptyState
				className="h-full"
				title="This task is not in the run's trace"
				description="Its attempt may have been pruned with the run's retention, or the run it belonged to has been deleted."
			/>
		);
	}

	const { prev, next } = context;

	return (
		<Dashboard
			className="h-full min-h-0 overflow-y-auto p-3"
			spec={spec}
			icons={DASHBOARD_ICONS}
			onAction={(id, ctx) => {
				switch (id) {
					case STEP_ACTIONS.view:
						if (ctx?.option) setView(ctx.option);
						return;
					case STEP_ACTIONS.prev:
						if (prev) onOpenStep(prev.head.id);
						return;
					case STEP_ACTIONS.next:
						if (next) onOpenStep(next.head.id);
						return;
					default:
						// `open-artifact` has nowhere to go until artifacts are stored
						// (SR34); the row is still listed, because the record names it.
						return;
				}
			}}
		/>
	);
}
