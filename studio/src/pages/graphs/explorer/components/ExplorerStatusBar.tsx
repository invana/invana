import type { GraphRead } from "../../../../types/graphs";

interface ExplorerStatusBarProps {
	graph: GraphRead | undefined;
	nodeCount: number;
	relationshipCount: number;
	queryCount: number;
}

export function ExplorerStatusBar({
	graph,
	nodeCount,
	relationshipCount,
	queryCount,
}: ExplorerStatusBarProps) {
	const isActive = graph?.status === "ACTIVE";

	return (
		<div className="flex items-center justify-between w-full h-full px-2">
			{/* Left */}
			<div className="flex items-center gap-2 text-base text-muted-foreground">
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

			{/* Right */}
			<div className="flex items-center gap-3 text-base text-muted-foreground">
				<span>{nodeCount} nodes</span>
				<span>{relationshipCount} relationships</span>
				<span>{queryCount} queries</span>
			</div>
		</div>
	);
}
