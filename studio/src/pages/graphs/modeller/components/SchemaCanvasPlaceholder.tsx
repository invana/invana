import { GitGraph } from "lucide-react";

export function SchemaCanvasPlaceholder() {
	return (
		<div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground select-none">
			<GitGraph className="w-12 h-12 opacity-20" />
			<p className="font-medium">Schema Visualisation</p>
			<p className="opacity-60">
				Coming soon — select a type from the left panel to inspect
			</p>
		</div>
	);
}
