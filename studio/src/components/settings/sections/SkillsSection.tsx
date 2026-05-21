import { Construction } from "lucide-react";

export function SkillsSection() {
	return (
		<div className="border border-border rounded-lg p-8 flex flex-col items-center gap-4 text-center">
			<Construction className="w-10 h-10 text-muted-foreground" />
			<div>
				<p className="font-medium">Lands in S5</p>
				<p className="text-muted-foreground mt-1">
					Define the skills available to agents querying this graph.
				</p>
			</div>
		</div>
	);
}
