/**
 * `plan_versions` · `plan_arguments` · `plan_export` — what `⋯` opens on a
 * plan's page, each as its own page beside it
 * ([LB38](../../../../../../../docs/for-developers/modules/workflows/features/the-library.md)).
 *
 * They fetch and answer actions; `planRecordSpecs` builds each document.
 */

import { Dashboard, type DashboardSpec } from "@invana/dashboard";
import { EmptyState, Spinner } from "@invana/ui";
import { type ReactNode, useMemo, useState } from "react";
import {
	planArgumentsSpec,
	planExportSpec,
	planVersionsSpec,
	RECORD_ACTIONS,
} from "@/pages/graphs-detail/features/plans/boards/planRecordSpecs";
import {
	usePlanDiffsQuery,
	usePlanExportQuery,
	usePlanVersionQuery,
	useTaskPlansQuery,
} from "@/pages/graphs-detail/features/plans/queries";
import type { TaskPlanSummary } from "@/pages/graphs-detail/features/plans/types";
import { DASHBOARD_ICONS } from "@/pages/graphs-detail/shared/dashboardIcons";

interface RecordPageProps {
	username: string;
	graphSlug: string;
	/** The `task_plans.id` the board is keyed by — one version. */
	planId: string;
	/** The crumb naming the plan — back to its page. */
	onOpenPlan: (planId: string) => void;
}

/** The version the board names, and every version of its key. */
function usePlanRecord(username: string, graphSlug: string, planId: string) {
	const library = useTaskPlansQuery(username, graphSlug);
	const plan = library.data?.items.find((p) => p.id === planId);
	const versions = useMemo(
		() => (library.data?.items ?? []).filter((p) => plan && p.key === plan.key),
		[library.data, plan],
	);
	return { loading: library.isLoading, plan, versions };
}

function Frame({
	loading,
	spec,
	onAction,
}: {
	loading: boolean;
	spec: DashboardSpec | null;
	onAction: (id: string, ctx?: { itemId?: string }) => void;
}): ReactNode {
	if (loading)
		return (
			<div className="flex h-full items-center justify-center">
				<Spinner />
			</div>
		);
	if (!spec)
		return (
			<EmptyState
				className="h-full"
				title="This plan is not in the library"
				description="It may have been retired. Close this page, or pick a plan in Library › Plans."
			/>
		);
	return (
		<Dashboard
			className="h-full min-h-0"
			spec={spec}
			registry={{}}
			icons={DASHBOARD_ICONS}
			onAction={onAction}
		/>
	);
}

const refOf = (p: TaskPlanSummary) => `${p.key}@${p.version}`;

export function PlanVersionsPage({
	username,
	graphSlug,
	planId,
	onOpenPlan,
}: RecordPageProps) {
	const { loading, plan, versions } = usePlanRecord(
		username,
		graphSlug,
		planId,
	);
	const [picked, setPicked] = useState<number | null>(null);
	const numbers = useMemo(() => versions.map((v) => v.version), [versions]);
	const results = usePlanDiffsQuery(
		username,
		graphSlug,
		plan?.key ?? undefined,
		numbers,
	);
	const diffs = new Map(
		results.flatMap((r) => (r.data ? [[r.data.version, r.data] as const] : [])),
	);
	const spec = plan
		? planVersionsSpec(refOf(plan), versions, diffs, picked ?? plan.version)
		: null;
	return (
		<Frame
			loading={loading}
			spec={spec}
			onAction={(id, ctx) => {
				if (id === RECORD_ACTIONS.openPlan) onOpenPlan(planId);
				if (id === RECORD_ACTIONS.pickVersion && ctx?.itemId)
					setPicked(Number(ctx.itemId.slice(1)));
			}}
		/>
	);
}

export function PlanArgumentsPage({
	username,
	graphSlug,
	planId,
	onOpenPlan,
}: RecordPageProps) {
	const { loading, plan } = usePlanRecord(username, graphSlug, planId);
	const detail = usePlanVersionQuery(
		username,
		graphSlug,
		plan?.key ?? undefined,
		plan?.version,
	);
	const spec =
		plan && detail.data
			? planArgumentsSpec(
					refOf(plan),
					detail.data.args_schema ?? {},
					detail.data.callers,
				)
			: null;
	return (
		<Frame
			loading={loading || (!!plan && detail.isLoading)}
			spec={spec}
			onAction={(id) => {
				if (id === RECORD_ACTIONS.openPlan) onOpenPlan(planId);
			}}
		/>
	);
}

export function PlanExportPage({
	username,
	graphSlug,
	planId,
	onOpenPlan,
}: RecordPageProps) {
	const { loading, plan } = usePlanRecord(username, graphSlug, planId);
	const yaml = usePlanExportQuery(
		username,
		graphSlug,
		plan?.key ?? undefined,
		plan?.version,
	);
	const spec = plan ? planExportSpec(refOf(plan), yaml.data) : null;
	return (
		<Frame
			loading={loading}
			spec={spec}
			onAction={(id) => {
				if (id === RECORD_ACTIONS.openPlan) onOpenPlan(planId);
				if (!plan || yaml.data === undefined) return;
				if (id === RECORD_ACTIONS.copy)
					void navigator.clipboard.writeText(yaml.data);
				if (id === RECORD_ACTIONS.download) {
					// The text already on screen, saved as the file the engine
					// would have named — not a second fetch of the same bytes.
					const url = URL.createObjectURL(
						new Blob([yaml.data], { type: "application/yaml" }),
					);
					const a = document.createElement("a");
					a.href = url;
					a.download = `${refOf(plan)}.yml`;
					a.click();
					URL.revokeObjectURL(url);
				}
			}}
		/>
	);
}
