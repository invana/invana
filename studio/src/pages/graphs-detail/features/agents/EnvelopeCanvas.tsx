/**
 * An agent's envelope on the {@link LayeredCanvas}: two columns, the tasks it is
 * allowed and the ones it is not, with the `require` rules between allowed tasks.
 * A fixed layout — two piles, not a flow.
 */

import {
	LayeredCanvas,
	type LayeredEdge,
	type LayeredNode,
} from "@/canvases/layered/LayeredCanvas";
import { useAgentsQuery } from "@/hooks/queries/useWork";

interface Scope {
	username: string;
	graphSlug: string;
}

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

	const nodes: LayeredNode[] = ALL_TASKS.map((task) => ({
		id: task,
		label: task,
		sub: spec.pins?.[task]
			? `pinned: ${Object.keys(spec.pins[task]).join(", ")}`
			: undefined,
		column: allow.has(task) ? 0 : 1,
		tone: allow.has(task) ? "success" : "muted",
		disabled: !allow.has(task),
	}));

	const edges: LayeredEdge[] = (
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
		<LayeredCanvas
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
