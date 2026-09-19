/**
 * The four work canvases (docs/for-developers/modules/work/spec.md), each adapted onto one {@link WorkGraphCanvas}.
 *
 * Every adapter answers the same two questions — what are the columns, and
 * what does an edge mean — and nothing else. Keeping them in one file makes
 * the differences visible: a `plan`'s column is a **wave**, a `workflow`'s is
 * **required order**, a `lineage`'s is **causal depth**, and an `envelope` has
 * only two (allowed and disallowed).
 *
 * The renderer underneath is the Explorer's and Modeller's canvas (docs/for-developers/modules/explore/features/graph-canvas.md).
 * There is no second one any more.
 */

import {
	useAgentLineageQuery,
	useAgentsQuery,
	useProjectPlanQuery,
	useWorkflowQuery,
} from "@/hooks/queries/useWork";
import {
	type WorkEdge,
	WorkGraphCanvas,
	type WorkNode,
} from "@/pages/graphs-detail/features/work/WorkGraphCanvas";
import { taskTone } from "@/pages/graphs-detail/shared/statusTone";
import type { AgentEdge } from "@/types/work";
import { useMemo } from "react";

interface Scope {
	username: string;
	graphSlug: string;
}

// ── plan ─────────────────────────────────────────────────────────────────────

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

	const nodes: WorkNode[] = (plan.data?.tasks ?? []).map((task) => ({
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

	const edges: WorkEdge[] = (plan.data?.edges ?? []).map((edge) => ({
		id: `${edge.source}->${edge.target}`,
		source: edge.source,
		target: edge.target,
		highlight: critical.has(edge.source) && critical.has(edge.target),
	}));

	return (
		<WorkGraphCanvas
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

// ── workflow ─────────────────────────────────────────────────────────────────

/**
 * The steps every plan carries whatever the ask was. They are the **frame**,
 * not the workflow — drawn quiet, so the template's own steps carry the accent
 * (docs/for-developers/modules/agents/spec.md).
 */
const ALWAYS_PRESENT = new Set([
	"understand_intent",
	"understand_ask",
	"plan_workflow",
	"verify_result",
]);

export function WorkflowCanvas({
	username,
	graphSlug,
	workflowKey,
	selectedStepId,
	onSelectStep,
}: Scope & {
	workflowKey: string;
	selectedStepId: string | null;
	onSelectStep: (id: string | null) => void;
}) {
	const workflow = useWorkflowQuery(username, graphSlug, workflowKey);

	const nodes: WorkNode[] = (workflow.data?.nodes ?? []).map((step) => ({
		id: step.id,
		label: step.label,
		sub: step.pinned.length
			? // A **count**, never a claim: a pin lives on one agent's envelope and
				// a library entry is used by N of them (docs/for-developers/modules/explore/features/selection-and-the-panel.md).
				`${step.task} · ${step.pinned_by_count > 1 ? `pinned by ${step.pinned_by_count}` : "pinned"}`
			: step.task,
		// The engine's `depth` — the longest path from a root, not the index in
		// the stored list. Two steps share a column exactly when neither waits on
		// the other, which is how `nl-compare`'s two readings come out as two
		// branches instead of one false chain.
		column: step.depth,
		tone: ALWAYS_PRESENT.has(step.task) ? "muted" : "info",
	}));

	const edges: WorkEdge[] = (workflow.data?.edges ?? []).map((edge) => ({
		id: `${edge.kind}:${edge.source}->${edge.target}`,
		source: edge.source,
		target: edge.target,
		label: edge.label || undefined,
		dashed: edge.kind === "binding",
	}));

	return (
		<WorkGraphCanvas
			kind="workflow"
			nodes={nodes}
			edges={edges}
			selectedNodeId={selectedStepId}
			onSelectNode={(id) => onSelectStep(id === selectedStepId ? null : id)}
			emptyHint={
				workflow.isLoading
					? "Drawing the workflow…"
					: "Pick a workflow from the panel to draw it."
			}
		/>
	);
}

// ── envelope ─────────────────────────────────────────────────────────────────

// Every task the interpreter knows, split by whether this envelope permits it —
// "what this agent may not do" is as much of the answer as what it may.
const ALL_TASKS = [
	"understand_intent",
	"plan_workflow",
	"translate_thought",
	"validate_query",
	"execute_graph_query",
	"shape_for_canvas",
	"verify_result",
	"spawn_agent",
	"delegate",
	"await_delegations",
	"create_task",
];

export function EnvelopeCanvas({
	username,
	graphSlug,
	agentId,
	selectedStepId,
	onSelectStep,
}: Scope & {
	agentId: string;
	selectedStepId: string | null;
	onSelectStep: (id: string | null) => void;
}) {
	const agents = useAgentsQuery(username, graphSlug, {
		includeEphemeral: true,
		includeRetired: true,
	});
	const agent = agents.data?.items.find((a) => a.id === agentId);

	const spec = (agent?.workflow_spec ?? {}) as {
		allow?: string[];
		require?: { task: string; after: string }[];
		pins?: Record<string, Record<string, unknown>>;
	};
	const allow = new Set(spec.allow ?? []);

	const nodes: WorkNode[] = ALL_TASKS.map((task) => ({
		id: task,
		label: task,
		sub: spec.pins?.[task]
			? `pinned: ${Object.keys(spec.pins[task]).join(", ")}`
			: undefined,
		column: allow.has(task) ? 0 : 1,
		tone: allow.has(task) ? "success" : "muted",
		disabled: !allow.has(task),
	}));

	const edges: WorkEdge[] = (
		spec.require ?? [{ task: "execute_graph_query", after: "validate_query" }]
	)
		.filter((rule) => allow.has(rule.task) && allow.has(rule.after))
		.map((rule) => ({
			id: `require:${rule.after}->${rule.task}`,
			source: rule.after,
			target: rule.task,
			label: "require",
		}));

	return (
		<WorkGraphCanvas
			kind="envelope"
			nodes={nodes}
			edges={edges}
			selectedNodeId={selectedStepId}
			onSelectNode={(id) => onSelectStep(id === selectedStepId ? null : id)}
			// Two piles, not a flow: layering them would shuffle the allow-list
			// around for no reason a reader could follow.
			layout="fixed"
			emptyHint="Pick an agent to draw what it is allowed to do."
		/>
	);
}

// ── lineage ──────────────────────────────────────────────────────────────────

export function LineageCanvas({
	username,
	graphSlug,
	agentId,
	selectedNodeId,
	selectedEdgeId,
	onSelectAgent,
	onSelectEdge,
	onOpenTask,
}: Scope & {
	agentId: string;
	selectedNodeId: string | null;
	selectedEdgeId: string | null;
	onSelectAgent: (id: string | null) => void;
	onSelectEdge: (edge: AgentEdge | null) => void;
	onOpenTask: (taskId: string) => void;
}) {
	const lineage = useAgentLineageQuery(username, graphSlug, agentId);

	const { nodes, edges } = useMemo(() => {
		const raw = lineage.data;
		if (!raw) return { nodes: [] as WorkNode[], edges: [] as WorkEdge[] };

		// Causal depth: people authored, agents were authored or spawned, tasks
		// were assigned. Three columns is the whole story.
		const column = (kind: string) =>
			kind === "user" ? 0 : kind === "agent" ? 1 : 2;

		return {
			nodes: raw.nodes.map(
				(node): WorkNode => ({
					id: node.id,
					label: node.label,
					sub:
						node.kind === "agent"
							? [
									node.agent_kind,
									node.lifetime === "ephemeral" ? "ephemeral" : null,
								]
									.filter(Boolean)
									.join(" · ")
							: node.kind === "task"
								? (node.status ?? "task")
								: "person",
					column: column(node.kind),
					tone:
						node.kind === "agent"
							? node.status === "retired"
								? "muted"
								: node.status === "paused"
									? "warning"
									: "success"
							: "muted",
					nodeKind: node.kind,
				}),
			),
			edges: raw.edges.map(
				(edge): WorkEdge => ({
					id: edge.id,
					source: edge.source,
					target: edge.target,
					label: edge.label,
					dashed: edge.kind === "assigned",
				}),
			),
		};
	}, [lineage.data]);

	return (
		<WorkGraphCanvas
			kind="lineage"
			nodes={nodes}
			edges={edges}
			selectedNodeId={selectedNodeId}
			selectedEdgeId={selectedEdgeId}
			onSelectNode={(id, node) => {
				// **The per-node-kind branch** (docs/for-developers/modules/explore/features/selection-and-the-panel.md). An agent selects into
				// the roster; a task navigates, because the Agents panel has no row
				// for one; a person is inert — MVP has no person surface, so there
				// is nowhere to go and nothing to state.
				if (node?.nodeKind === "agent") {
					onSelectAgent(id === selectedNodeId ? null : id);
					onSelectEdge(null);
				} else if (node?.nodeKind === "task" && id) {
					onOpenTask(id);
				}
			}}
			onSelectEdge={(id) => {
				const edge = lineage.data?.edges.find((e) => e.id === id) ?? null;
				// Selecting an edge clears the roster's selected row: an edge is
				// selected, not an agent.
				onSelectEdge(id === selectedEdgeId ? null : edge);
				if (id && id !== selectedEdgeId) onSelectAgent(null);
			}}
			emptyHint="Pick an agent to draw who created it and what it has worked on."
		/>
	);
}
