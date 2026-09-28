import type { ReactNode } from "react";
import {
	EnvelopeCanvas,
	LineageCanvas,
} from "@/pages/graphs-detail/features/agents";
import { PlanFlowCanvas } from "@/pages/graphs-detail/features/plans";
import { PlanCanvas } from "@/pages/graphs-detail/features/projects";
import type { LeftNavKey } from "@/pages/graphs-detail/shared/useLeftSection";
import type { useLayeredCanvas } from "@/pages/graphs-detail/shell/useLayeredCanvas";
import { ApiError } from "@/services/api/client";

/**
 * What the main area says when it has nothing to draw.
 *
 * Every work panel owns a canvas kind, and selecting a row opens it — so the
 * only honest empty state is *which row to pick*, phrased in the vocabulary
 * of the panel you are actually looking at.
 */
export function canvasEmptyHint(settingsSection: LeftNavKey): string {
	return settingsSection === "model"
		? "Pick a model to draw it — its types as nodes, its edge types as the edges between them."
		: settingsSection === "projects"
			? "Pick a project to draw its plan — todos as cards, dependencies left to right."
			: settingsSection === "runs"
				? "Pick a run to read it — what it cost, what it touched and what was refused. `Compare with the plan` draws the plan it ran here."
				: settingsSection === "library"
					? "Pick a plan to draw the flow it will run. A template decides what its answer looks like; the catalogue is what it may name at all."
					: settingsSection === "agents"
						? "Pick an agent to draw who created it and what it has worked on."
						: settingsSection === "skills"
							? "A skill has no canvas of its own — open a session, project or agent and the skill panel stays beside it."
							: settingsSection === "govern"
								? "A world has no canvas of its own — it is the bound whatever you open next runs inside."
								: "Open a session or start a new one to see its canvas.";
}

/**
 * The layered canvas `mainSection` draws while a panel drove it there — a
 * project's plan, a plan's flow, an agent's envelope or lineage. Null when
 * the selection it needs is not there.
 */
export function layeredCanvasBody(
	layered: ReturnType<typeof useLayeredCanvas>,
	username: string | undefined,
	graphSlug: string | undefined,
	openWorkPanel: (section: "projects") => void,
): ReactNode {
	const {
		workKind,
		selectedProjectKey,
		selectedTaskId,
		setSelectedTaskId,
		planError,
		setPlanError,
		taskMutations,
		selectedWorkflowKey,
		selectedStepId,
		setSelectedStepId,
		selectedAgentId,
		setSelectedAgentId,
		selectedLineageEdge,
		setSelectedLineageEdge,
	} = layered;
	return workKind === "plan" && selectedProjectKey ? (
		<PlanCanvas
			username={username as string}
			graphSlug={graphSlug as string}
			projectKey={selectedProjectKey}
			selectedTaskId={selectedTaskId}
			onSelectTask={setSelectedTaskId}
			onAddDependency={(taskId, dependsOnId) => {
				setPlanError(null);
				taskMutations.addDependency.mutate(
					{ id: taskId, dependsOnId },
					{
						onError: (err) =>
							setPlanError(
								err instanceof ApiError
									? err.message
									: "That dependency could not be added.",
							),
					},
				);
			}}
			error={planError}
		/>
	) : workKind === "workflow" && selectedWorkflowKey ? (
		<PlanFlowCanvas
			username={username as string}
			graphSlug={graphSlug as string}
			workflowKey={selectedWorkflowKey}
			selectedStepId={selectedStepId}
			onSelectStep={setSelectedStepId}
		/>
	) : workKind === "envelope" && selectedAgentId ? (
		<EnvelopeCanvas
			username={username as string}
			graphSlug={graphSlug as string}
			agentId={selectedAgentId}
			selectedStepId={selectedStepId}
			onSelectStep={setSelectedStepId}
		/>
	) : workKind === "lineage" && selectedAgentId ? (
		<LineageCanvas
			username={username as string}
			graphSlug={graphSlug as string}
			agentId={selectedAgentId}
			selectedNodeId={selectedAgentId}
			selectedEdgeId={selectedLineageEdge?.id ?? null}
			onSelectAgent={setSelectedAgentId}
			onSelectEdge={setSelectedLineageEdge}
			onOpenTask={(id) => {
				// A Todo lives under Projects (PT7); the rail's Tasks icon is
				// execution only.
				setSelectedTaskId(id);
				openWorkPanel("projects");
			}}
		/>
	) : null;
}
