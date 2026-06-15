import { Button } from "@invana/ui";
import { Network } from "lucide-react";
import type { QueryResponse } from "../../../../types/query";
import { ResultsTable } from "./ResultsTable";

// Renders an assistant reply's result inline in the thread (RFC-033): a windowed
// table for tabular results, a summary + "Load to canvas" for graph results.
// Results are transient (held in the page, re-fetched by re-run) — RFC-024.

export interface ResultBlockProps {
	result: QueryResponse | null | undefined;
	onLoadToCanvas: (result: QueryResponse) => void;
}

export function ResultBlock({ result, onLoadToCanvas }: ResultBlockProps) {
	if (!result) return null;

	if (result.result_type === "tabular") {
		if (!result.rows || result.rows.length === 0) return null;
		return <ResultsTable rows={result.rows} />;
	}

	if (result.result_type === "graph" && result.data) {
		const nodes = result.data.nodes.length;
		const edges = result.data.edges.length;
		if (nodes === 0 && edges === 0) return null;
		return (
			<div className="mt-1 flex items-center justify-between rounded border border-border px-2 py-1.5">
				<span className="text-muted-foreground">
					{nodes} node{nodes === 1 ? "" : "s"} · {edges} edge
					{edges === 1 ? "" : "s"}
				</span>
				<Button
					variant="secondary"
					size="sm"
					onClick={() => onLoadToCanvas(result)}
				>
					<Network className="mr-1.5 h-3.5 w-3.5" />
					Load to canvas
				</Button>
			</div>
		);
	}

	return null;
}
