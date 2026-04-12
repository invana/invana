import { ScrollArea } from "@invana/ui";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";
import type {
	EdgeTypeResponse,
	NodeTypeResponse,
} from "../../../../types/schemas";
import type { SelectedItem } from "./DetailPanel";

interface Props {
	nodeTypes: NodeTypeResponse[];
	edgeTypes: EdgeTypeResponse[];
	propertyKeyCount: number;
	constraintCount: number;
	indexCount: number;
	selected: SelectedItem;
	onSelect: (item: SelectedItem) => void;
}

function SectionHeader({
	label,
	count,
	open,
	onClick,
}: {
	label: string;
	count: number;
	open: boolean;
	onClick: () => void;
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			className="flex w-full items-center justify-between px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground hover:text-foreground transition-colors"
		>
			<span className="flex items-center gap-1">
				{open ? (
					<ChevronDown className="w-3 h-3" />
				) : (
					<ChevronRight className="w-3 h-3" />
				)}
				{label}
			</span>
			<span>{count}</span>
		</button>
	);
}

function NavItem({
	label,
	active,
	onClick,
}: {
	label: string;
	active: boolean;
	onClick: () => void;
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			className={`w-full text-left px-6 py-1 text-sm rounded-sm transition-colors ${
				active
					? "bg-accent text-accent-foreground font-medium"
					: "hover:bg-accent/50 text-foreground"
			}`}
		>
			{label}
		</button>
	);
}

function GlobalItem({
	label,
	count,
	active,
	onClick,
}: {
	label: string;
	count: number;
	active: boolean;
	onClick: () => void;
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			className={`flex w-full items-center justify-between px-3 py-1.5 text-sm rounded-sm transition-colors ${
				active
					? "bg-accent text-accent-foreground font-medium"
					: "hover:bg-accent/50 text-muted-foreground hover:text-foreground"
			}`}
		>
			<span>{label}</span>
			<span className="text-xs">{count}</span>
		</button>
	);
}

export function SchemaNav({
	nodeTypes,
	edgeTypes,
	propertyKeyCount,
	constraintCount,
	indexCount,
	selected,
	onSelect,
}: Props) {
	const [nodeTypesOpen, setNodeTypesOpen] = useState(true);
	const [edgeTypesOpen, setEdgeTypesOpen] = useState(true);

	const isNodeActive = (id: string) =>
		selected?.kind === "node-type" && selected.id === id;
	const isEdgeActive = (id: string) =>
		selected?.kind === "edge-type" && selected.id === id;

	return (
		<ScrollArea className="h-full">
			<div className="py-2 flex flex-col gap-1">
				{/* Node Types */}
				<SectionHeader
					label="Node Types"
					count={nodeTypes.length}
					open={nodeTypesOpen}
					onClick={() => setNodeTypesOpen((o) => !o)}
				/>
				{nodeTypesOpen && (
					<div className="flex flex-col">
						{nodeTypes.length === 0 ? (
							<p className="px-6 py-1 text-xs text-muted-foreground italic">
								None
							</p>
						) : (
							nodeTypes.map((nt) => (
								<NavItem
									key={nt.id}
									label={nt.name}
									active={isNodeActive(nt.id)}
									onClick={() => onSelect({ kind: "node-type", id: nt.id })}
								/>
							))
						)}
					</div>
				)}

				{/* Edge Types */}
				<SectionHeader
					label="Edge Types"
					count={edgeTypes.length}
					open={edgeTypesOpen}
					onClick={() => setEdgeTypesOpen((o) => !o)}
				/>
				{edgeTypesOpen && (
					<div className="flex flex-col">
						{edgeTypes.length === 0 ? (
							<p className="px-6 py-1 text-xs text-muted-foreground italic">
								None
							</p>
						) : (
							edgeTypes.map((et) => (
								<NavItem
									key={et.id}
									label={et.name}
									active={isEdgeActive(et.id)}
									onClick={() => onSelect({ kind: "edge-type", id: et.id })}
								/>
							))
						)}
					</div>
				)}

				{/* Global sections */}
				<div className="mt-2 flex flex-col gap-0.5 px-1">
					<GlobalItem
						label="Property Keys"
						count={propertyKeyCount}
						active={selected?.kind === "property-keys"}
						onClick={() => onSelect({ kind: "property-keys" })}
					/>
					<GlobalItem
						label="Constraints"
						count={constraintCount}
						active={selected?.kind === "constraints"}
						onClick={() => onSelect({ kind: "constraints" })}
					/>
					<GlobalItem
						label="Indexes"
						count={indexCount}
						active={selected?.kind === "indexes"}
						onClick={() => onSelect({ kind: "indexes" })}
					/>
				</div>
			</div>
		</ScrollArea>
	);
}
