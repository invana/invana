import { ScrollArea, TabbedPanel } from "@invana/ui";
import { Network, Paintbrush, SlidersHorizontal } from "lucide-react";
import type { QueryResultItem } from "../../../../types/query";

interface InspectorPanelProps {
	selected: QueryResultItem | null;
	allItems: QueryResultItem[];
}

export function InspectorPanel({ selected, allItems }: InspectorPanelProps) {
	// Resolve the full item from allItems using selected.id
	const item = selected
		? (allItems.find((i) => i.id === selected.id) ?? selected)
		: null;

	const propertiesContent = (
		<ScrollArea className="h-full">
			{!item ? (
				<div className="flex flex-col items-center justify-center gap-2 text-muted-foreground p-6 mt-12">
					<Network className="w-8 h-8 opacity-20" />
					<p className="text-center">Click a node or edge to inspect it</p>
				</div>
			) : (
				<div className="p-4 flex flex-col gap-4">
					<div>
						<div className="flex items-center gap-2 mb-1">
							<span
								className={`text-[10px] font-medium uppercase px-1.5 py-0.5 rounded ${
									item.type === "vertex"
										? "bg-blue-500/20 text-blue-400"
										: "bg-purple-500/20 text-purple-400"
								}`}
							>
								{item.type}
							</span>
							<span className="font-semibold">{item.label}</span>
						</div>
						<p className="text-[10px] text-muted-foreground font-mono break-all">
							{item.id}
						</p>
					</div>

					{item.type === "edge" && (
						<div>
							<p className="text-muted-foreground mb-1.5">Endpoints</p>
							<div className="flex flex-col gap-1 text-xs font-mono">
								<div className="flex gap-2">
									<span className="text-muted-foreground w-12 shrink-0">
										source
									</span>
									<span className="text-foreground break-all">
										{item.source ?? "—"}
									</span>
								</div>
								<div className="flex gap-2">
									<span className="text-muted-foreground w-12 shrink-0">
										target
									</span>
									<span className="text-foreground break-all">
										{item.target ?? "—"}
									</span>
								</div>
							</div>
						</div>
					)}

					<div>
						<p className="text-muted-foreground mb-1.5">Properties</p>
						{Object.keys(item.properties).length === 0 ? (
							<p className="text-muted-foreground italic">No properties</p>
						) : (
							<div className="flex flex-col gap-1.5">
								{Object.entries(item.properties).map(([key, val]) => (
									<div key={key} className="flex flex-col gap-0.5">
										<span className="text-[10px] text-muted-foreground">
											{key}
										</span>
										<span className="text-xs font-mono text-foreground break-all">
											{String(val)}
										</span>
									</div>
								))}
							</div>
						)}
					</div>
				</div>
			)}
		</ScrollArea>
	);

	const designContent = (
		<div className="flex flex-col items-center justify-center h-full gap-2 text-muted-foreground">
			<Paintbrush className="w-8 h-8 opacity-20" />
			<p className="text-center">Style overrides — coming soon</p>
		</div>
	);

	return (
		<TabbedPanel
			defaultTab="properties"
			tabs={[
				{
					value: "properties",
					label: "Properties",
					icon: SlidersHorizontal,
					content: propertiesContent,
				},
				{
					value: "design",
					label: "Design",
					icon: Paintbrush,
					content: designContent,
				},
			]}
		/>
	);
}
