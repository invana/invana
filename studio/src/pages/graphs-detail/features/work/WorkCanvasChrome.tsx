/**
 * The chrome around a work canvas — the tab that names it, and the status line
 * that counts it (`studio.md` § 6.26, docs/for-developers/modules/explore/features/selection-and-the-panel.md F4).
 *
 * A work canvas takes the same slot as the Explorer's data canvas, and until
 * now it took it *bare*: no tab, no title, no footer, and no way back to the
 * session's canvas except re-selecting in the panel. That reads as a mode the
 * app fell into rather than a canvas the user opened.
 *
 * Both pieces switch on `kind` through {@link CANVAS_KINDS}, which is where the
 * per-kind vocabulary already lives — so a seventh kind is one entry there, not
 * a hunt through two components.
 */

import {
	useAgentLineageQuery,
	useAgentsQuery,
	useProjectPlanQuery,
	useWorkflowQuery,
} from "@/hooks/queries/useWork";
import { CANVAS_KINDS } from "@/pages/graphs-detail/features/boards";
import { cn } from "@invana/ui";
import { X } from "lucide-react";

/** What the open work canvas is drawing. One shape per kind, id included. */
export type WorkCanvasTarget =
	| { kind: "workflow"; workflowKey: string }
	| { kind: "plan"; projectKey: string }
	| { kind: "envelope"; agentId: string }
	| { kind: "lineage"; agentId: string };

interface Scope {
	username: string;
	graphSlug: string;
	target: WorkCanvasTarget;
}

/**
 * Title and counts come from the same queries the canvas itself runs, so this
 * costs no extra request — TanStack serves both from one cache entry.
 */
function useSubject({ username, graphSlug, target }: Scope): {
	title: string;
	metrics: string[];
} {
	const workflow = useWorkflowQuery(
		username,
		graphSlug,
		target.kind === "workflow" ? target.workflowKey : undefined,
	);
	const plan = useProjectPlanQuery(
		username,
		graphSlug,
		target.kind === "plan" ? target.projectKey : undefined,
	);
	const agents = useAgentsQuery(username, graphSlug, {
		includeEphemeral: true,
		includeRetired: true,
		enabled: target.kind === "envelope" || target.kind === "lineage",
	});
	// Served from the same cache entry the LineageCanvas populates — the footer
	// counts what is drawn rather than guessing at it.
	const lineage = useAgentLineageQuery(
		username,
		graphSlug,
		target.kind === "lineage" ? target.agentId : undefined,
	);

	if (target.kind === "workflow") {
		const detail = workflow.data;
		// A plan has no `spec`: it is its `tasks` rows. Declared parameters come
		// from `args_schema` when the parameter form lands (7.7).
		const params: string[] = [];
		return {
			title: detail ? `${detail.key}@${detail.version}` : target.workflowKey,
			metrics: detail
				? [
						plural(detail.nodes.length, "step"),
						...(params.length ? [plural(params.length, "param")] : []),
						plural(detail.used_by.length, "agent"),
						// A rate with no verified run behind it is not 0% — it is
						// "not asked yet", and the footer says which.
						detail.served_rate === null
							? detail.runs
								? `${plural(detail.runs, "run")} · not verified`
								: "never run"
							: `served ${Math.round(detail.served_rate * 100)}% of ${plural(detail.runs, "run")}`,
					]
				: [],
		};
	}
	if (target.kind === "plan") {
		const tasks = plan.data?.tasks ?? [];
		return {
			title: target.projectKey,
			metrics: tasks.length
				? [
						plural(tasks.length, "task"),
						plural(plan.data?.edges.length ?? 0, "dependency", "dependencies"),
						plural(new Set(tasks.map((t) => t.wave)).size, "wave"),
					]
				: [],
		};
	}

	const agent = agents.data?.items.find((a) => a.id === target.agentId);
	if (target.kind === "envelope") {
		// The envelope's own shape, not the agent's row: how much this agent is
		// allowed to do, and which shared plans it may reach for.
		const spec = (agent?.workflow_spec ?? {}) as {
			allow?: string[];
			templates?: string[];
		};
		return {
			title: agent?.name ?? "Agent",
			metrics: agent
				? [
						plural(spec.allow?.length ?? 0, "step"),
						plural(spec.templates?.length ?? 0, "template"),
					]
				: [],
		};
	}
	// lineage — what is drawn, counted the way the canvas counts it.
	const graph = lineage.data;
	return {
		title: agent?.name ?? "Agent",
		metrics: graph
			? [plural(graph.nodes.length, "node"), plural(graph.edges.length, "edge")]
			: [],
	};
}

/** The tab strip: which canvas this is, and the way back to the session's. */
export function WorkCanvasHeader({
	username,
	graphSlug,
	target,
	onClose,
}: Scope & { onClose: () => void }) {
	const spec = CANVAS_KINDS[target.kind];
	const { title } = useSubject({ username, graphSlug, target });
	const Icon = spec.icon;
	return (
		<div className="flex h-9 shrink-0 items-center border-b bg-card px-1.5">
			<div className="flex h-7 items-center gap-1.5 rounded-sm border border-primary/40 bg-primary/10 px-2 text-sm">
				<Icon className="h-3.5 w-3.5 text-primary" />
				<span className="font-mono">{title}</span>
				<span className="text-muted-foreground">{spec.label}</span>
				<button
					type="button"
					title="Close this canvas"
					aria-label="Close this canvas"
					onClick={onClose}
					className="ml-0.5 text-muted-foreground hover:text-foreground"
				>
					<X className="h-3.5 w-3.5" />
				</button>
			</div>
		</div>
	);
}

/**
 * The status line, in the slot the data canvas's telemetry uses. The first
 * word is the kind's own footer (`LIBRARY` · `PLAN` · `ENVELOPE` · `TRACE`) —
 * a workflow canvas is not `ACTIVE`, because nothing on it is running.
 */
export function WorkCanvasStatus({ username, graphSlug, target }: Scope) {
	const spec = CANVAS_KINDS[target.kind];
	const { metrics } = useSubject({ username, graphSlug, target });
	return (
		<div className="flex items-center gap-2 text-sm">
			<span
				className={cn(
					"font-medium",
					target.kind === "plan" ? "text-primary" : "text-muted-foreground",
				)}
			>
				{spec.footer}
			</span>
			{metrics.map((metric) => (
				<span key={metric} className="text-muted-foreground">
					· {metric}
				</span>
			))}
		</div>
	);
}

function plural(count: number, noun: string, plural?: string): string {
	return `${count} ${count === 1 ? noun : (plural ?? `${noun}s`)}`;
}
