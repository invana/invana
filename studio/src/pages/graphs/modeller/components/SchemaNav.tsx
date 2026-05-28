import { ScrollArea } from "@invana/ui";
import { ChevronDown, ChevronRight, Plus, Trash2 } from "lucide-react";
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
	editable?: boolean;
	onAddNodeType?: () => void;
	onAddEdgeType?: () => void;
	onDeleteNodeType?: (id: string) => void;
	onDeleteEdgeType?: (id: string) => void;
}

function SectionHeader({
	label,
	count,
	open,
	onClick,
	onAdd,
}: {
	label: string;
	count: number;
	open: boolean;
	onClick: () => void;
	onAdd?: () => void;
}) {
	return (
		<div className="flex w-full items-center justify-between pr-2">
			<button
				type="button"
				onClick={onClick}
				className="flex flex-1 items-center gap-1 px-3 py-1.5 text-base font-semibold uppercase tracking-wide text-muted-foreground hover:text-foreground transition-colors"
			>
				{open ? (
					<ChevronDown className="w-3 h-3" />
				) : (
					<ChevronRight className="w-3 h-3" />
				)}
				{label}
				<span className="ml-auto pr-2">{count}</span>
			</button>
			{onAdd && (
				<button
					type="button"
					title={`Add ${label.toLowerCase()}`}
					onClick={onAdd}
					className="text-muted-foreground hover:text-foreground transition-colors"
				>
					<Plus className="w-3.5 h-3.5" />
				</button>
			)}
		</div>
	);
}

function NavItem({
	label,
	active,
	onClick,
	onDelete,
}: {
	label: string;
	active: boolean;
	onClick: () => void;
	onDelete?: () => void;
}) {
	return (
		<div
			className={`group flex items-center pr-2 rounded-sm transition-colors ${
				active ? "bg-accent" : "hover:bg-accent/50"
			}`}
		>
			<button
				type="button"
				onClick={onClick}
				className={`flex-1 text-left px-6 py-1 ${
					active ? "text-accent-foreground font-medium" : "text-foreground"
				}`}
			>
				{label}
			</button>
			{onDelete && (
				<button
					type="button"
					title="Delete"
					onClick={onDelete}
					className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity"
				>
					<Trash2 className="w-3.5 h-3.5" />
				</button>
			)}
		</div>
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
			className={`flex w-full items-center justify-between px-3 py-1.5 rounded-sm transition-colors ${
				active
					? "bg-accent text-accent-foreground font-medium"
					: "hover:bg-accent/50 text-muted-foreground hover:text-foreground"
			}`}
		>
			<span>{label}</span>
			<span className="text-base">{count}</span>
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
	editable = false,
	onAddNodeType,
	onAddEdgeType,
	onDeleteNodeType,
	onDeleteEdgeType,
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
					onAdd={editable ? onAddNodeType : undefined}
				/>
				{nodeTypesOpen && (
					<div className="flex flex-col">
						{nodeTypes.length === 0 ? (
							<p className="px-6 py-1 text-muted-foreground italic">None</p>
						) : (
							nodeTypes.map((nt) => (
								<NavItem
									key={nt.id}
									label={nt.name}
									active={isNodeActive(nt.id)}
									onClick={() => onSelect({ kind: "node-type", id: nt.id })}
									onDelete={
										editable ? () => onDeleteNodeType?.(nt.id) : undefined
									}
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
					onAdd={editable ? onAddEdgeType : undefined}
				/>
				{edgeTypesOpen && (
					<div className="flex flex-col">
						{edgeTypes.length === 0 ? (
							<p className="px-6 py-1 text-muted-foreground italic">None</p>
						) : (
							edgeTypes.map((et) => (
								<NavItem
									key={et.id}
									label={et.name}
									active={isEdgeActive(et.id)}
									onClick={() => onSelect({ kind: "edge-type", id: et.id })}
									onDelete={
										editable ? () => onDeleteEdgeType?.(et.id) : undefined
									}
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
