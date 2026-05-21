import { Construction } from "lucide-react";

export function DatasetsSection() {
	return (
		<div className="border border-border rounded-lg p-8 flex flex-col items-center gap-4 text-center">
			<Construction className="w-10 h-10 text-muted-foreground" />
			<div>
				<p className="font-medium">Lands in S6</p>
				<p className="text-muted-foreground mt-1">
					Import data into this knowledge graph.
				</p>
			</div>
		</div>
	);
}
