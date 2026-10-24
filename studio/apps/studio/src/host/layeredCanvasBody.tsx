import { EnvelopeCanvas, LineageCanvas } from "@invana-studio/agents";
import { ApiError } from "@invana-studio/core";
import { PlanCanvas } from "@invana-studio/projects";
import type { LeftNavKey } from "@invana-studio/shell";
import type { ReactNode } from "react";
import type { useLayeredCanvas } from "@/host/useLayeredCanvas";

/**
 * What the main area says when it has nothing to draw.
 *
 * Every work panel owns a canvas kind, and selecting a row opens it — so the
 * only honest empty state is *which row to pick*, phrased in the vocabulary
 * of the panel you are actually looking at.
 */
const EMPTY_HINTS: Partial<Record<LeftNavKey, string>> = {
	model:
		"Pick a model to draw it — its types as nodes, its edge types as the edges between them.",
	projects:
		"Pick a project to draw its plan — todos as cards, dependencies left to right.",
	decisions: "Opens with engine support.",
	runs: "Pick a run to read it — what it cost, what it touched and what was refused. `Compare with the plan` draws the plan it ran here.",
	govern:
		"A world has no canvas of its own — it is the bound whatever you open next runs inside.",
	rules:
		"Open a rule to read it here — how often steps were offered it, cited it and never cited it.",
	requests:
		"A request has no canvas of its own — each one names the type or property it asks the model for.",
	settings:
		"Graph settings have no canvas — the form beside is the whole of it.",
};

export function canvasEmptyHint(settingsSection: LeftNavKey): string {
	return (
		EMPTY_HINTS[settingsSection] ??
		"Open a session or start a new one to see its canvas."
	);
}

/**
 * The layered canvas `mainSection` draws while a panel drove it there — a
 * project's plan, an agent's envelope or lineage. Null when
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
				// A Todo lives under Projects; the rail's Tasks icon is
				// execution only.
				setSelectedTaskId(id);
				openWorkPanel("projects");
			}}
		/>
	) : null;
}
