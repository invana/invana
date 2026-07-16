import { ScrollArea } from "@invana/ui";
import {
	ChevronDown,
	ChevronRight,
	Hash,
	KeyRound,
	ListTree,
} from "lucide-react";
import { type ReactNode, useState } from "react";
import type {
	ConstraintResponse,
	EdgeTypeResponse,
	GraphVersionResponse,
	IndexResponse,
	NodeTypeResponse,
	TypePropertyMappingResponse,
} from "../../../../types/schemas";

interface Props {
	version: GraphVersionResponse | undefined;
	isLoading?: boolean;
}

// Read-only, file-manager-style overview of the active graph model: node/edge
// types → expand → Properties / Indexes / Constraints → leaf rows with data
// types. Purely presentational (no fetching, no editing) — the Explorer page
// feeds it the active schema version. Authoring lives in the Modeller. This is
// the "Overview" tab of the Explorer model browser (SchemaBrowser); the graph
// rendering of the same schema is the "Canvas" tab.

// Monospace badge for a property's data type — keeps the leaf rows scannable
// like a SQL schema browser without pulling in the Modeller's table component.
function DataTypeBadge({
	type,
	className,
}: { type: string; className?: string }) {
	return (
		<span
			className={`shrink-0 rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-muted-foreground${className ? ` ${className}` : ""}`}
		>
			{type}
		</span>
	);
}

// A collapsible row with a chevron + label + count. Used for every level of the
// tree (top sections, type rows, the per-type sub-sections).
function TreeRow({
	label,
	count,
	open,
	onClick,
	depth,
	icon,
	mono,
}: {
	label: string;
	count?: number;
	open: boolean;
	onClick: () => void;
	depth: number;
	icon?: ReactNode;
	mono?: boolean;
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			style={{ paddingLeft: `${depth * 12 + 8}px` }}
			className="group flex w-full items-center gap-1 rounded-md py-1 pr-2 text-foreground transition-colors hover:bg-primary/10 hover:text-primary"
		>
			{open ? (
				<ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" />
			) : (
				<ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" />
			)}
			{icon}
			<span className={mono ? "font-mono" : undefined}>{label}</span>
			{count != null && (
				<span className="ml-auto pr-1 text-xs text-muted-foreground">
					{count}
				</span>
			)}
		</button>
	);
}

// A non-expandable leaf (a property / index / constraint entry).
function LeafRow({
	depth,
	children,
}: {
	depth: number;
	children: ReactNode;
}) {
	return (
		<div
			style={{ paddingLeft: `${depth * 12 + 20}px` }}
			className="flex items-center gap-2 py-0.5 pr-2 text-sm"
		>
			{children}
		</div>
	);
}

function PropertyLeaf({
	mapping,
	depth,
}: {
	mapping: TypePropertyMappingResponse;
	depth: number;
}) {
	const pk = mapping.property_key;
	return (
		<LeafRow depth={depth}>
			<span className="truncate font-mono text-foreground">{pk.name}</span>
			{pk.value_cardinality !== "SINGLE" && (
				<span className="shrink-0 text-xs text-muted-foreground">
					{pk.value_cardinality.toLowerCase()}
				</span>
			)}
			{mapping.inherited && (
				<span className="shrink-0 text-xs italic text-muted-foreground">
					inherited
				</span>
			)}
			<DataTypeBadge type={pk.type} className="ml-auto" />
		</LeafRow>
	);
}

function IndexLeaf({ index, depth }: { index: IndexResponse; depth: number }) {
	return (
		<LeafRow depth={depth}>
			<KeyRound className="h-3 w-3 shrink-0 text-muted-foreground" />
			<span className="font-mono text-foreground">{index.name}</span>
			<span className="text-xs text-muted-foreground">
				{index.index_type} · {index.properties.join(", ")}
			</span>
		</LeafRow>
	);
}

function ConstraintLeaf({
	constraint,
	depth,
}: {
	constraint: ConstraintResponse;
	depth: number;
}) {
	return (
		<LeafRow depth={depth}>
			<Hash className="h-3 w-3 shrink-0 text-muted-foreground" />
			<span className="font-mono text-foreground">{constraint.name}</span>
			<span className="text-xs text-muted-foreground">
				{constraint.constraint_type} · {constraint.properties.join(", ")}
			</span>
		</LeafRow>
	);
}

// One collapsible sub-section (Properties / Indexes / Constraints) under a type.
function SubSection({
	label,
	depth,
	items,
	render,
}: {
	label: string;
	depth: number;
	items: { id: string }[];
	render: (item: { id: string }, depth: number) => ReactNode;
}) {
	const [open, setOpen] = useState(false);
	if (items.length === 0) return null;
	return (
		<>
			<TreeRow
				label={label}
				count={items.length}
				open={open}
				onClick={() => setOpen((o) => !o)}
				depth={depth}
			/>
			{open && items.map((item) => render(item, depth + 1))}
		</>
	);
}

function TypeRow({
	name,
	depth,
	subtitle,
	properties,
	indexes,
	constraints,
}: {
	name: string;
	depth: number;
	subtitle?: ReactNode;
	properties: TypePropertyMappingResponse[];
	indexes: IndexResponse[];
	constraints: ConstraintResponse[];
}) {
	const [open, setOpen] = useState(false);
	const sortedProperties = [...properties].sort((a, b) =>
		a.property_key.name.localeCompare(b.property_key.name),
	);
	return (
		<>
			<TreeRow
				label={name}
				open={open}
				onClick={() => setOpen((o) => !o)}
				depth={depth}
				mono
			/>
			{open && (
				<>
					{subtitle && (
						<div
							style={{ paddingLeft: `${(depth + 1) * 12 + 20}px` }}
							className="py-0.5 text-xs text-muted-foreground"
						>
							{subtitle}
						</div>
					)}
					<SubSection
						label="Properties"
						depth={depth + 1}
						items={sortedProperties}
						render={(item, d) => (
							<PropertyLeaf
								key={item.id}
								mapping={item as TypePropertyMappingResponse}
								depth={d}
							/>
						)}
					/>
					<SubSection
						label="Indexes"
						depth={depth + 1}
						items={indexes}
						render={(item, d) => (
							<IndexLeaf
								key={item.id}
								index={item as IndexResponse}
								depth={d}
							/>
						)}
					/>
					<SubSection
						label="Constraints"
						depth={depth + 1}
						items={constraints}
						render={(item, d) => (
							<ConstraintLeaf
								key={item.id}
								constraint={item as ConstraintResponse}
								depth={d}
							/>
						)}
					/>
				</>
			)}
		</>
	);
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
			className="flex w-full items-center gap-1 px-3 py-1.5 text-base font-semibold uppercase tracking-wide text-muted-foreground transition-colors hover:text-foreground"
		>
			{open ? (
				<ChevronDown className="h-3 w-3" />
			) : (
				<ChevronRight className="h-3 w-3" />
			)}
			{label}
			<span className="ml-auto pr-2">{count}</span>
		</button>
	);
}

export function SchemaOverview({ version, isLoading }: Props) {
	const [nodeTypesOpen, setNodeTypesOpen] = useState(true);
	const [edgeTypesOpen, setEdgeTypesOpen] = useState(true);

	const nodeTypes = version?.node_types ?? [];
	const edgeTypes = version?.edge_types ?? [];
	const indexes = version?.indexes ?? [];
	const constraints = version?.constraints ?? [];

	const indexesFor = (kind: IndexResponse["target_kind"], label: string) =>
		indexes.filter((i) => i.target_kind === kind && i.target_label === label);
	const constraintsFor = (
		kind: ConstraintResponse["target_kind"],
		label: string,
	) =>
		constraints.filter(
			(c) => c.target_kind === kind && c.target_label === label,
		);

	const propertiesOf = (nt: NodeTypeResponse) =>
		nt.effective_property_mappings.length > 0
			? nt.effective_property_mappings
			: nt.property_mappings;

	const edgeSubtitle = (et: EdgeTypeResponse): ReactNode => {
		const src = et.source_node_types.join(", ") || "any";
		const tgt = et.target_node_types.join(", ") || "any";
		return `${src} → ${tgt}`;
	};

	if (isLoading) {
		return (
			<div className="flex h-full items-center justify-center text-sm text-muted-foreground">
				Loading model…
			</div>
		);
	}

	if (nodeTypes.length === 0 && edgeTypes.length === 0) {
		return (
			<div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center text-muted-foreground">
				<ListTree className="h-6 w-6" />
				<p className="text-sm">No model yet</p>
				<p className="text-xs">
					This graph has no published model. Define one in the Modeller.
				</p>
			</div>
		);
	}

	return (
		<ScrollArea className="h-full">
			<div className="flex flex-col gap-1 py-2">
				<SectionHeader
					label="Node Types"
					count={nodeTypes.length}
					open={nodeTypesOpen}
					onClick={() => setNodeTypesOpen((o) => !o)}
				/>
				{nodeTypesOpen &&
					(nodeTypes.length === 0 ? (
						<p className="px-6 py-1 italic text-muted-foreground">None</p>
					) : (
						nodeTypes.map((nt) => (
							<TypeRow
								key={nt.id}
								name={nt.name}
								depth={1}
								properties={propertiesOf(nt)}
								indexes={indexesFor("node_type", nt.name)}
								constraints={constraintsFor("node_type", nt.name)}
							/>
						))
					))}

				<SectionHeader
					label="Edge Types"
					count={edgeTypes.length}
					open={edgeTypesOpen}
					onClick={() => setEdgeTypesOpen((o) => !o)}
				/>
				{edgeTypesOpen &&
					(edgeTypes.length === 0 ? (
						<p className="px-6 py-1 italic text-muted-foreground">None</p>
					) : (
						edgeTypes.map((et) => (
							<TypeRow
								key={et.id}
								name={et.name}
								depth={1}
								subtitle={edgeSubtitle(et)}
								properties={et.property_mappings}
								indexes={indexesFor("edge_type", et.name)}
								constraints={constraintsFor("edge_type", et.name)}
							/>
						))
					))}
			</div>
		</ScrollArea>
	);
}
