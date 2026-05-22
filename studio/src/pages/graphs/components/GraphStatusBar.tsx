import type { ReactNode } from "react";
import type { GraphConnectionRead } from "../../../types/graphs";

interface Props {
	/** The graph's connection record. Undefined while loading; null when the
	 *  engine is unreachable. */
	graph: GraphConnectionRead | undefined;
	/** Page-specific metrics rendered after the connection chip on the left.
	 *  Examples: Explorer adds "0 nodes · 0 relationships · 0 queries",
	 *  Modeller adds "0 node types · 0 edge types". */
	metrics?: ReactNode;
}

/**
 * Shared status-bar left content for graph-scoped pages (Overview / Explorer
 * / Modeller). Renders a connection chip — coloured dot + ACTIVE/status + URI
 * — that is identical across every page. Pages plug page-specific counters
 * into the `metrics` slot. Footer right-side content (version, page label)
 * stays in each page's own `footer.right`.
 */
export function GraphStatusBar({ graph, metrics }: Props) {
	const isActive = graph?.status === "ACTIVE";

	return (
		<div className="flex items-center gap-3 px-2 text-base text-muted-foreground">
			<div className="flex items-center gap-2">
				<span
					className={`w-1.5 h-1.5 rounded-full shrink-0 ${
						isActive ? "bg-green-500" : "bg-destructive animate-pulse"
					}`}
				/>
				{graph ? (
					<>
						<span className={isActive ? "text-green-500" : "text-destructive"}>
							{isActive ? "ACTIVE" : graph.status}
						</span>
						<span>•</span>
						<span className="font-mono">{graph.uri}</span>
					</>
				) : (
					<span>API is down — reconnecting…</span>
				)}
			</div>
			{metrics ? (
				<>
					<span>•</span>
					{metrics}
				</>
			) : null}
		</div>
	);
}
