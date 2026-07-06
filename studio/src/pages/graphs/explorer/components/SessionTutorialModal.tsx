import {
	Button,
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@invana/ui";
import {
	MessageSquareText,
	MousePointerClick,
	Network,
	Share2,
	Workflow,
} from "lucide-react";
import type { ComponentType } from "react";

// localStorage flag so the tutorial auto-opens only on a user's first session
// (RFC-045). Reopenable anytime via the "?" in the canvas header.
const SEEN_KEY = "explorer.session.tutorial.seen";

export function hasSeenSessionTutorial(): boolean {
	try {
		return localStorage.getItem(SEEN_KEY) === "true";
	} catch {
		return true; // storage blocked → don't nag
	}
}

export function markSessionTutorialSeen(): void {
	try {
		localStorage.setItem(SEEN_KEY, "true");
	} catch {
		// ignore — private mode / blocked storage
	}
}

interface Capability {
	icon: ComponentType<{ className?: string }>;
	title: string;
	body: string;
}

const CAPABILITIES: Capability[] = [
	{
		icon: MessageSquareText,
		title: "Query",
		body: "Ask in plain language or write Cypher/Gremlin directly. Each answer is grounded in your graph and traceable back to the query that produced it.",
	},
	{
		icon: Share2,
		title: "Expand",
		body: "Right-click any node to pull its neighbours — all of them, by node type, or along a specific relationship — and grow the picture outward, one hop at a time.",
	},
	{
		icon: Network,
		title: "Visualise",
		body: "Results paint onto the session's canvas, laid out automatically. Style nodes and edges by type to make the structure you care about pop.",
	},
	{
		icon: MousePointerClick,
		title: "Interact",
		body: "Pan, zoom, drag and select. Click a node to inspect its properties, or hover to light up its neighbourhood.",
	},
	{
		icon: Workflow,
		title: "Run complex logic",
		body: "Chain queries and refine with follow-ups — each session keeps its own thread and its own canvas you can return to.",
	},
];

interface Props {
	open: boolean;
	onClose: () => void;
}

/**
 * The session tutorial (RFC-045): what you can do in a session — query, expand,
 * visualise, interact, run complex logic. Auto-shown once on a user's first
 * session; reopenable from the "?" action in the canvas header.
 */
export function SessionTutorialModal({ open, onClose }: Props) {
	return (
		<Dialog open={open} onOpenChange={(o) => !o && onClose()}>
			<DialogContent className="max-w-lg">
				<DialogHeader>
					<DialogTitle>Welcome to the Explorer</DialogTitle>
					<DialogDescription>
						A session is your workspace for exploring the graph. Here's what you
						can do.
					</DialogDescription>
				</DialogHeader>
				<ul className="space-y-3 pt-2">
					{CAPABILITIES.map((c) => (
						<li key={c.title} className="flex gap-3">
							<span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted text-foreground">
								<c.icon className="h-4 w-4" />
							</span>
							<div className="min-w-0">
								<p className="font-medium text-sm">{c.title}</p>
								<p className="text-muted-foreground text-sm">{c.body}</p>
							</div>
						</li>
					))}
				</ul>
				<DialogFooter>
					<Button onClick={onClose}>Got it</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
