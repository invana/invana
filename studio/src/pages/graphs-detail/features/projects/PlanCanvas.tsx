/**
 * A project's plan on the {@link LayeredCanvas}: one column per **wave**, an edge
 * for each dependency, the critical path highlighted. Connect is the one write it
 * makes — dragging card to card adds a dependency.
 *
 * `EnvelopeCanvas` and `LineageCanvas` in `features/agents/` are the other two
 * adapters on the same renderer. A library plan draws on `TaskFlowCanvas` instead.
 */

import { useMemo } from "react";
import {
	LayeredCanvas,
	type LayeredEdge,
	type LayeredNode,
} from "@/canvases/layered/LayeredCanvas";
import { useProjectPlanQuery } from "@/pages/graphs-detail/features/projects/queries";
import { taskTone } from "@/pages/graphs-detail/shared/statusTone";

interface Scope {
	username: string;
	graphSlug: string;
}

export function PlanCanvas({
	username,
	graphSlug,
	projectKey,
	selectedTaskId,
	onSelectTask,
	onAddDependency,
	error,
}: Scope & {
	projectKey: string;
	selectedTaskId: string | null;
	onSelectTask: (id: string | null) => void;
	/** Connect card → card. The **only** write any of these four canvases makes. */
	onAddDependency: (taskId: string, dependsOnId: string) => void;
	error?: string | null;
}) {
	const plan = useProjectPlanQuery(username, graphSlug, projectKey);
	const critical = useMemo(
		() => new Set(plan.data?.critical_path ?? []),
		[plan.data],
	);

	const nodes: LayeredNode[] = (plan.data?.tasks ?? []).map((task) => ({
		id: task.id,
		label: task.title,
		sub:
			[
				task.assignee_name ?? "unassigned",
				task.due_at ? new Date(task.due_at).toLocaleDateString() : null,
			]
				.filter(Boolean)
				.join(" · ") || undefined,
		column: task.wave,
		tone: taskTone(task.status),
	}));

	const edges: LayeredEdge[] = (plan.data?.edges ?? []).map((edge) => ({
		id: `${edge.source}->${edge.target}`,
		source: edge.source,
		target: edge.target,
		highlight: critical.has(edge.source) && critical.has(edge.target),
	}));

	return (
		<LayeredCanvas
			kind="plan"
			nodes={nodes}
			edges={edges}
			selectedNodeId={selectedTaskId}
			onSelectNode={(id) => onSelectTask(id === selectedTaskId ? null : id)}
			// `source` finishes first, so the *target* is the one that gains a
			// dependency — the direction the endpoint expects.
			onConnect={(source, target) => onAddDependency(target, source)}
			error={error}
			emptyHint="No tasks in this project yet. Add one, then use Connect to say what waits on what."
		/>
	);
}
