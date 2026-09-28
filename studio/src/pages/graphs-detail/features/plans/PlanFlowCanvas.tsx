/**
 * A library plan's flow on `TaskFlowCanvas`
 * ([LB35](docs/for-developers/modules/workflows/features/the-library.md)).
 *
 * The same canvas a skill's Flow tab and a run's Flow tab draw on, so a plan,
 * a skill that inlines it and a run of it read as one drawing. Read-only:
 * `Edit as a draft` is the way to change a plan. Picking a node selects its
 * step, which the drawer's step card reads.
 */

import {
	TaskFlowCanvas,
	taskFlowSettings,
	taskFlowTemplates,
} from "@/canvases/taskflow";
import { useWorkflowQuery } from "@/hooks/queries/useWork";
import { taskFlowFromTaskPlan } from "@/pages/graphs-detail/features/plans/taskFlowFromTaskPlan";
import { EmptyState, Spinner } from "@invana/ui";
import { Workflow } from "lucide-react";
import { useMemo } from "react";

export function PlanFlowCanvas({
	username,
	graphSlug,
	workflowKey,
	selectedStepId,
	onSelectStep,
}: {
	username: string;
	graphSlug: string;
	workflowKey: string;
	selectedStepId: string | null;
	onSelectStep: (id: string | null) => void;
}) {
	const workflow = useWorkflowQuery(username, graphSlug, workflowKey);
	const data = useMemo(
		() => (workflow.data ? taskFlowFromTaskPlan(workflow.data) : null),
		[workflow.data],
	);

	if (workflow.isLoading) return <Spinner />;
	if (!data || data.nodes.length === 0)
		return (
			<div className="px-3 py-4">
				<EmptyState
					icon={<Workflow className="size-6" />}
					title="No flow to draw"
					description="This plan has no steps. Edit it as a draft to add one."
				/>
			</div>
		);

	return (
		<TaskFlowCanvas
			data={data}
			settings={taskFlowSettings}
			templates={taskFlowTemplates}
			title={workflowKey}
			selectedId={selectedStepId}
			onOpenNode={(id) => onSelectStep(id === selectedStepId ? null : id)}
		/>
	);
}
