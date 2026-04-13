import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@invana/ui";
import { GitGraph } from "lucide-react";

export function NoSelectionPlaceholder() {
	return (
		<div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
			<GitGraph className="w-10 h-10 opacity-30" />
			<p className="text-center max-w-xs">
				Select a node type, edge type, property key, constraint, or index from
				the left panel to view its details.
			</p>
		</div>
	);
}

// Satisfy TS — re-export to avoid "unused import" in tests
export { Table, TableBody, TableCell, TableHead, TableHeader, TableRow };
