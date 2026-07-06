import {
	MessageSquareText,
	MousePointerClick,
	Network,
	Share2,
	Workflow,
} from "lucide-react";
import type { ComponentType } from "react";

export interface Capability {
	icon: ComponentType<{ className?: string }>;
	title: string;
	/** Full description — the one-time welcome modal. */
	body: string;
	/** Terse one-liner — the inline empty-thread helper. */
	short: string;
}

/**
 * What you can do in an Explorer session (RFC-045). Shared by the one-time
 * welcome modal ({@link SessionTutorialModal}), which uses the full `body`, and
 * the inline empty-thread helper ({@link SessionThreadWelcome}), which uses the
 * terse `short`, so both stay in sync.
 */
export const CAPABILITIES: Capability[] = [
	{
		icon: MessageSquareText,
		title: "Query",
		body: "Ask in plain language or write Cypher/Gremlin directly. Each answer is grounded in your graph and traceable back to the query that produced it.",
		short: "Ask in plain language or Cypher/Gremlin.",
	},
	{
		icon: Share2,
		title: "Expand",
		body: "Right-click any node to pull its neighbours — all of them, by node type, or along a specific relationship — and grow the picture outward, one hop at a time.",
		short: "Right-click a node to pull its neighbours.",
	},
	{
		icon: Network,
		title: "Visualise",
		body: "Results paint onto the session's canvas, laid out automatically. Style nodes and edges by type to make the structure you care about pop.",
		short: "Results paint onto the canvas, laid out for you.",
	},
	{
		icon: MousePointerClick,
		title: "Interact",
		body: "Pan, zoom, drag and select. Click a node to inspect its properties, or hover to light up its neighbourhood.",
		short: "Pan, zoom, click to inspect, hover to highlight.",
	},
	{
		icon: Workflow,
		title: "Run complex logic",
		body: "Chain queries and refine with follow-ups — each session keeps its own thread and its own canvas you can return to.",
		short: "Chain queries and refine with follow-ups.",
	},
];
