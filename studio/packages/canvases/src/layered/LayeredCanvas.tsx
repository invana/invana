/**
 * **One canvas, four kinds** — `plan` · `workflow` · `envelope` · `lineage`
 * drawn through `@invana/canvas-react`, the same stack the Explorer and the
 * Modeller use ([canvas kinds](../../../../../docs/for-developers/modules/explore/spec.md)).
 *
 * These four used to render as bespoke inline SVG. The argument for that — a
 * few dozen labelled boxes is a different job from 100K records at 60fps — was
 * true about the *data* and irrelevant to the *work*: what a small DAG needs is
 * layout, labelled edges, selection, fit, pan, zoom and theme, and the shared
 * canvas had already answered every one of them. The SVG answered them again,
 * worse, and one of those answers made the engine lie: a renderer that could
 * only draw a line asked for a chain, so `nl-compare` claimed its second
 * reading of the graph waited on the first.
 *
 * Each kind supplies **data and meaning**; canvas-ui's `LayeredDagBoard` draws
 * it — this file only maps a kind's rows and legend onto the board:
 *
 * | Kind | Column is | An edge is | Writes from a gesture |
 * |---|---|---|---|
 * | `plan` | a wave | a dependency (finish → start) | **yes** — drag card → card |
 * | `workflow` | required order | order · `${steps.X.y}` binding | no |
 * | `envelope` | allowed vs not | a `require` precondition | no |
 * | `lineage` | causal depth | authored · spawned · delegated-for | no |
 * | `branches` | fork depth | a fork · a merge (dashed) | no |
 * | `provenance` | author → dataset · run → finding → decision | a cite · authorship | no |
 * | `impact` | a hop from the cited records | a relationship type joining two groups | no |
 *
 * **The canvas law still holds** (docs/for-developers/modules/agents/features/lineage.md): it selects and draws. Exactly
 * one kind writes, `plan`, and only where the geometry *is* the datum —
 * drawing the edge is creating the dependency — and it hands off to the same
 * endpoint the panel uses.
 */

import {
	type DagBoardSelection,
	type DagLegendSpec,
	LayeredDagBoard,
} from "@invana/canvas-ui";
import type { GraphData } from "@invana/graph";
import type { Tone } from "@invana-studio/ui";
import { useMemo } from "react";

/**
 * The same status vocabulary the panels use, so a task drawn on the plan and the
 * same task listed beside it cannot disagree about what colour it is. The board's
 * `DAG_TONES` carries exactly these names.
 */
type LayeredTone = Tone;

/** The canvas kinds a board may draw here; `data` and `model` have no legend. */
type LayeredKind =
	| "plan"
	| "workflow"
	| "envelope"
	| "lineage"
	| "branches"
	| "provenance"
	| "impact"
	| "data"
	| "model";

export interface LayeredNode {
	id: string;
	label: string;
	/** Second line under the label — an assignee, a task key, a status. */
	sub?: string;
	/** The kind's semantic axis: a wave, a depth, allowed-vs-not. */
	column: number;
	tone?: LayeredTone;
	/** Drawn hollow and faded — a step this envelope does not allow. */
	disabled?: boolean;
	/** `lineage` only: which of agent / user / task this node is. */
	nodeKind?: string;
}

export interface LayeredEdge {
	id: string;
	source: string;
	target: string;
	label?: string;
	/** Dashed — a binding, or an assignment: something other than plain order. */
	dashed?: boolean;
	/** On the critical path: the one thing drawn in the accent colour. */
	highlight?: boolean;
}

interface Props {
	kind: LayeredKind;
	nodes: LayeredNode[];
	edges: LayeredEdge[];
	selectedNodeId?: string | null;
	selectedEdgeId?: string | null;
	onSelectNode?: (id: string | null, node: LayeredNode | null) => void;
	onSelectEdge?: (id: string | null) => void;
	/**
	 * Drag node → node. Only `plan` passes this; passing it turns on the
	 * Connect tool, and the canvas's one write with it.
	 */
	onConnect?: (sourceId: string, targetId: string) => void;
	/**
	 * `layered` runs ELK; `fixed` keeps the seeded columns. An `envelope` is a
	 * classification, not a flow — layering its two piles moves them around for
	 * no reason.
	 */
	layout?: "layered" | "fixed";
	/** Shown in place of the legend copy — e.g. a 422 that named the loop. */
	error?: string | null;
	emptyHint?: string;
}

/**
 * Fit a node's label to the space a column actually has.
 *
 * Task titles are sentences ("List single-sourced parts and their suppliers"),
 * and the renderer draws a label as one unbroken line under the node — so on a
 * plan with six real tasks the labels ran straight through their neighbours and
 * the graph became unreadable.
 *
 * **Every label is exactly one line, plus the sub-line when there is one.** A
 * fixed two-line box is the one shape the layout can reserve room for exactly.
 * Truncation is safe here: the panel beside the canvas carries every title in
 * full, so nothing is only ever visible in a clipped form.
 */
const LABEL_CHARS = 24;

function clampLine(line: string): string {
	return line.length > LABEL_CHARS
		? `${line.slice(0, LABEL_CHARS - 1)}…`
		: line;
}

const CONNECT = {
	label: "Connect — drag a task onto the one that waits for it",
	hint: "Connect: drag a task onto the one that waits for it. Everything else is edited in the panel.",
};

export function LayeredCanvas({
	kind,
	nodes,
	edges,
	selectedNodeId,
	selectedEdgeId,
	onSelectNode,
	onSelectEdge,
	onConnect,
	layout = "layered",
	error,
	emptyHint,
}: Props) {
	const data = useMemo(
		(): GraphData =>
			({
				nodes: nodes.map((node) => ({
					id: node.id,
					type: node.nodeKind ?? kind,
					data: {
						text: node.sub
							? `${clampLine(node.label)}\n${clampLine(node.sub)}`
							: clampLine(node.label),
						tone: node.tone ?? "muted",
						disabled: !!node.disabled,
						column: node.column,
					},
				})),
				edges: edges.map((edge) => ({
					id: edge.id,
					source: edge.source,
					target: edge.target,
					// The distinction the board draws is the one `dashed` names: a
					// binding or an assignment, against plain order.
					type: edge.dashed ? "binding" : "order",
					data: {
						label: edge.label ?? "",
						dashed: !!edge.dashed,
						highlight: !!edge.highlight,
					},
				})),
			}) as unknown as GraphData,
		[nodes, edges, kind],
	);

	const selected: DagBoardSelection = selectedNodeId
		? { kind: "node", id: selectedNodeId }
		: selectedEdgeId
			? { kind: "edge", id: selectedEdgeId }
			: null;

	const onSelect = (next: DagBoardSelection) => {
		const nodeId = next?.kind === "node" ? next.id : null;
		const edgeId = next?.kind === "edge" ? next.id : null;
		if (nodeId !== (selectedNodeId ?? null))
			onSelectNode?.(nodeId, nodes.find((n) => n.id === nodeId) ?? null);
		if (edgeId !== (selectedEdgeId ?? null)) onSelectEdge?.(edgeId);
	};

	const legend = LEGENDS[kind];
	return (
		<LayeredDagBoard
			data={data}
			chrome="panel"
			layout={layout}
			theme="tokens"
			legend={legend.keys.length || legend.note ? legend : undefined}
			error={error ?? null}
			emptyHint={emptyHint ?? "Nothing to draw yet."}
			selected={selected}
			onSelect={onSelect}
			{...(onConnect
				? {
						connect: {
							...CONNECT,
							// The refetch is what draws the edge, so the picture can never
							// claim a dependency the backend rejected.
							onConnect: (source: string, target: string) => {
								onConnect(source, target);
								return null;
							},
						},
					}
				: {})}
		/>
	);
}

// ── Legend ───────────────────────────────────────────────────────────────────

const LEGENDS: Record<LayeredKind, DagLegendSpec> = {
	plan: {
		keys: [
			{ swatch: "node", tone: "success", label: "done" },
			{ swatch: "node", tone: "info", label: "in progress · critical path" },
			{ swatch: "node", tone: "warning", label: "review · needs input" },
			{
				swatch: "node",
				tone: "muted",
				label: "blocked · waiting on dependencies",
			},
			{ swatch: "edge", label: "finish → start" },
		],
		note: "Order is derived: dependencies first, then due date · columns are waves — what can run in parallel.",
	},
	workflow: {
		keys: [
			{
				swatch: "node",
				tone: "muted",
				label: "always present (plan · verify)",
			},
			{ swatch: "node", tone: "info", label: "template step" },
			{ swatch: "edge", label: "required order" },
			// biome-ignore lint/suspicious/noTemplateCurlyInString: the copy shows the binding syntax itself
			{ swatch: "edge", dashed: true, label: "${steps.X.y} binding" },
		],
		note: "A workflow is the reusable plan. Each agent's envelope decides which workflows it may select and pins what a plan cannot change. Clicking a step selects it; nothing here is editable.",
	},
	envelope: {
		keys: [
			{ swatch: "node", tone: "success", label: "this agent may run it" },
			{ swatch: "node", tone: "muted", dashed: true, label: "it may not" },
			{ swatch: "edge", label: "require" },
		],
		note: "What the agent may not do is as much of the answer as what it may. The envelope is edited in the panel, with Save.",
	},
	lineage: {
		keys: [
			{ swatch: "node", tone: "success", label: "agent · active" },
			{ swatch: "node", tone: "warning", label: "agent · ephemeral / paused" },
			{ swatch: "node", tone: "muted", label: "person" },
			{ swatch: "node", tone: "info", label: "task" },
			{ swatch: "edge", dashed: true, label: "assigned" },
		],
		// Three kinds of node live here, and a click means something different on
		// each — so the legend says which, rather than leaving a user to find out
		// by being navigated somewhere they did not expect.
		note: "An agent selects into the agents list. A task opens in Tasks — this panel has no row for it. A person has no surface in MVP. An edge is an event: selecting one says what happened, for whom, and why.",
	},
	branches: {
		keys: [
			{ swatch: "node", tone: "success", label: "pursuing" },
			{ swatch: "node", tone: "info", label: "open · merged" },
			{ swatch: "node", tone: "muted", label: "parked" },
			{ swatch: "node", tone: "error", dashed: true, label: "dropped" },
			{ swatch: "edge", label: "forked" },
			{ swatch: "edge", dashed: true, label: "merged into" },
		],
		note: "A branch sits right of the one it was forked from. Click a branch to open it; fork, decide and merge from its page.",
	},
	provenance: {
		keys: [
			{ swatch: "node", tone: "muted", label: "original author" },
			{ swatch: "node", tone: "info", label: "dataset · run" },
			{ swatch: "node", tone: "warning", label: "finding, not reviewed" },
			{ swatch: "node", tone: "success", label: "reviewed finding · decision" },
			{ swatch: "edge", label: "cited by" },
			{ swatch: "edge", dashed: true, label: "authored" },
		],
		note: "Read left to right: who first wrote the data, the datasets and runs it reached, the findings that cite them, the decision. Click a node to open it.",
	},
	impact: {
		keys: [
			{ swatch: "node", tone: "success", label: "what the evidence cites" },
			{ swatch: "node", tone: "info", label: "reached" },
			{ swatch: "node", tone: "warning", label: "reached · more lies beyond" },
			{ swatch: "edge", label: "relationship" },
		],
		note: "Read left to right: the records the option's evidence cites, then what each hop reaches — one node per type, with its count. Click a node to list what it holds.",
	},
	data: { keys: [], note: "" },
	model: { keys: [], note: "" },
};
