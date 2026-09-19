/**
 * The run dashboard, as a page — artboard **D1**, and what `More` opens
 * ([SR13](../../../../../../docs/for-developers/modules/operate/features/see-what-ran.md) ·
 * [CV14](../../../../../../docs/for-developers/modules/explore/features/boards.md)).
 *
 * The drawer stays the light overview; this is the detail, and it is a **page**
 * in `BoardPagesViewPanel` rather than a longer panel — a panel that tried to
 * be the dashboard would be a dashboard in 420px.
 *
 * The page fetches and answers actions. It composes nothing and renders no
 * panel: `runDashboardSpec` builds the document, `@invana/dashboard` draws it,
 * and everything a person can do arrives back here as one `onAction(id, ctx)`
 * because a function is not JSON ([SR30](../../../../../../docs/for-developers/modules/operate/features/see-what-ran.md)).
 */

import { TaskFlowPanel } from "@/pages/graphs-detail/features/operate/dashboards/TaskFlowPanel";
import { DASHBOARD_ICONS } from "@/pages/graphs-detail/features/operate/dashboards/icons";
import {
	RUN_ACTIONS,
	runDashboardSpec,
} from "@/pages/graphs-detail/features/operate/dashboards/runDashboardSpec";
import {
	VIEW_DASHBOARD,
	groupOf,
	groupSteps,
} from "@/pages/graphs-detail/features/operate/dashboards/shared";
import { useRunTrace } from "@/pages/graphs-detail/features/operate/dashboards/useRunTrace";
import { runsApi } from "@/services/api/runs";
import { Dashboard } from "@invana/dashboard";
import { EmptyState, Spinner } from "@invana/ui";
import { useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";

export interface RunDashboardPageProps {
	username: string;
	graphSlug: string;
	runId: string;
	/** A task on the flow opens its own dashboard, breadcrumbed under this one. */
	onOpenStep: (stepId: string) => void;
}

export function RunDashboardPage({
	username,
	graphSlug,
	runId,
	onOpenStep,
}: RunDashboardPageProps) {
	const trace = useRunTrace(username, graphSlug, runId);
	const client = useQueryClient();
	const [view, setView] = useState(VIEW_DASHBOARD);
	// Which task the log is filtered to. In-memory: a narrowed log is a reading
	// of this page, not a place a link carries (G31).
	const [selectedKey, setSelectedKey] = useState<string | null>(null);

	const spec = useMemo(
		() =>
			trace.data ? runDashboardSpec(trace.data, { view, selectedKey }) : null,
		[trace.data, view, selectedKey],
	);

	if (trace.isLoading) {
		return (
			<div className="flex h-full items-center justify-center">
				<Spinner />
			</div>
		);
	}
	if (!trace.data || !spec) {
		return (
			<EmptyState
				className="h-full"
				title="This run's trace has been pruned"
				description="A run keeps its counts and its outcome; its steps and emissions go with retention."
			/>
		);
	}

	const data = trace.data;

	return (
		<Dashboard
			className="h-full min-h-0 overflow-y-auto p-3"
			spec={spec}
			registry={{ flow: TaskFlowPanel }}
			icons={DASHBOARD_ICONS}
			onAction={(id, ctx) => {
				switch (id) {
					case RUN_ACTIONS.view:
						if (ctx?.option) setView(ctx.option);
						return;
					case RUN_ACTIONS.selectTask:
						// Picking the same row again clears the filter — the chip is the
						// Gantt row itself (SR15).
						setSelectedKey((current) =>
							current === ctx?.taskKey ? null : (ctx?.taskKey ?? null),
						);
						return;
					case RUN_ACTIONS.openStep:
						if (ctx?.itemId) onOpenStep(ctx.itemId);
						return;
					case RUN_ACTIONS.cancel:
						void runsApi
							.cancel(username, graphSlug, runId)
							.then(() => {
								toast.success("Cancelling this run");
								return client.invalidateQueries({
									queryKey: ["runs", username, graphSlug],
								});
							})
							.catch(() => toast.error("Could not cancel this run"));
						return;
					default:
						// A spec can only emit an id it carries, and every id it carries
						// is answered above. Nothing to do is not an error.
						void data;
				}
			}}
		/>
	);
}

/** The tab's title: what a run is called, read without opening the page. */
export function useRunPageTitle(
	username: string,
	graphSlug: string,
	runId: string,
): string {
	const trace = useRunTrace(username, graphSlug, runId);
	return trace.data?.body?.trim() || trace.data?.workflow_key || "Run";
}

/** The task a step id belongs to, for the step page's own tab title. */
export function useStepPageTitle(
	username: string,
	graphSlug: string,
	runId: string,
	stepId: string,
): string {
	const trace = useRunTrace(username, graphSlug, runId);
	const group = trace.data
		? groupOf(groupSteps(trace.data.steps), stepId)
		: undefined;
	return group?.key ?? "Step";
}
