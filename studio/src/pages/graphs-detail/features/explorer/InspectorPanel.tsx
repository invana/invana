import {
	ProvenanceBlock,
	isProvenanceKey,
	readProvenance,
} from "@/pages/graphs-detail/features/bring-data-in/ProvenanceBlock";
import type { QueryResultItem } from "@/types/query";
import { ScrollArea, TabbedPanel } from "@invana/ui";
import {
	Network,
	Paintbrush,
	PanelRightClose,
	SlidersHorizontal,
} from "lucide-react";

interface InspectorPanelProps {
	selected: QueryResultItem | null;
	allItems: QueryResultItem[];
	/** Collapse the panel, handing the freed width back to the canvas. */
	onClose: () => void;
	/**
	 * Elements the graph no longer holds, found when the canvas reopened.
	 *
	 * They stay drawn and are **marked** here (graph-canvas.md GC5) — a canvas
	 * that quietly dropped them would be claiming the exploration went differently
	 * than it did.
	 */
	missingIds?: ReadonlySet<string>;
	/** Resolves a dataset id to its name, when the list is loaded. */
	modelName?: (modelId: string) => string | undefined;
	/** Opens the Datasets panel on the dataset this element came from. */
	onOpenModel?: (modelId: string) => void;
}

export function InspectorPanel({
	selected,
	allItems,
	onClose,
	missingIds,
	modelName,
	onOpenModel,
}: InspectorPanelProps) {
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
								className={`text-sm font-medium uppercase px-1.5 py-0.5 rounded ${
									item.type === "vertex"
										? "bg-blue-500/20 text-blue-400"
										: "bg-purple-500/20 text-purple-400"
								}`}
							>
								{item.type}
							</span>
							<span className="font-semibold">{item.label}</span>
							{missingIds?.has(String(item.id)) ? (
								<span
									className="rounded bg-warning/15 px-1.5 py-0.5 text-sm font-medium uppercase text-warning"
									title="No longer in the graph — kept on the canvas so the exploration still reads true"
								>
									missing
								</span>
							) : null}
						</div>
						<p className="text-sm text-muted-foreground font-mono break-all">
							{item.id}
						</p>
					</div>

					{item.type === "edge" && (
						<div>
							<p className="text-muted-foreground mb-1.5">Endpoints</p>
							<div className="flex flex-col gap-1 font-mono">
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

					{/* Where it came from, before what it says — a value you cannot
					    trace is a value you cannot use (IW1). */}
					<ProvenanceBlock
						provenance={readProvenance(item.properties)}
						modelName={(() => {
							const p = readProvenance(item.properties);
							return p ? modelName?.(p.modelId) : undefined;
						})()}
						onOpenModel={onOpenModel}
					/>

					<div>
						<p className="text-muted-foreground mb-1.5">Properties</p>
						{Object.keys(item.properties).filter((k) => !isProvenanceKey(k))
							.length === 0 ? (
							<p className="text-muted-foreground italic">No properties</p>
						) : (
							<div className="flex flex-col gap-1.5">
								{Object.entries(item.properties)
									.filter(([key]) => !isProvenanceKey(key))
									.map(([key, val]) => (
										<div key={key} className="flex flex-col gap-0.5">
											<span className="text-sm text-muted-foreground">
												{key}
											</span>
											<span className="font-mono text-foreground break-all">
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
			headerActions={[
				{
					key: "close",
					name: "Collapse panel",
					icon: PanelRightClose,
					onClick: onClose,
				},
			]}
		/>
	);
}
