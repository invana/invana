import { Badge, Separator } from "@invana/ui";
import type {
	ConstraintResponse,
	EdgeTypeResponse,
	IndexResponse,
} from "../../../../types/schemas";
import { ConstraintTable } from "./ConstraintTable";
import { IndexTable } from "./IndexTable";
import { PropertyMappingTable } from "./PropertyMappingTable";

interface Props {
	edgeType: EdgeTypeResponse;
	constraints: ConstraintResponse[];
	indexes: IndexResponse[];
}

export function EdgeTypeDetail({ edgeType, constraints, indexes }: Props) {
	const filteredConstraints = constraints.filter(
		(c) => c.target_label === edgeType.name,
	);
	const filteredIndexes = indexes.filter(
		(i) => i.target_label === edgeType.name,
	);

	return (
		<div className="flex flex-col gap-6">
			{/* Header */}
			<div className="flex flex-col gap-1">
				<div className="flex items-center gap-2">
					<span className="text-lg font-semibold">{edgeType.name}</span>
					<Badge variant="secondary">edge type</Badge>
				</div>
				{edgeType.description ? (
					<p className="text-sm text-muted-foreground">
						{edgeType.description}
					</p>
				) : (
					<p className="text-sm text-muted-foreground">—</p>
				)}
				<div className="flex gap-4 text-xs text-muted-foreground mt-1">
					<span>
						<span className="font-medium">multiplicity:</span>{" "}
						{edgeType.multiplicity}
					</span>
				</div>
				<div className="flex gap-4 text-xs mt-1 flex-wrap">
					<div className="flex items-center gap-1">
						<span className="text-muted-foreground font-medium">source:</span>
						{edgeType.source_node_types.length > 0 ? (
							edgeType.source_node_types.map((t) => (
								<Badge key={t} variant="outline" className="text-xs">
									{t}
								</Badge>
							))
						) : (
							<span className="text-muted-foreground">—</span>
						)}
					</div>
					<div className="flex items-center gap-1">
						<span className="text-muted-foreground font-medium">target:</span>
						{edgeType.target_node_types.length > 0 ? (
							edgeType.target_node_types.map((t) => (
								<Badge key={t} variant="outline" className="text-xs">
									{t}
								</Badge>
							))
						) : (
							<span className="text-muted-foreground">—</span>
						)}
					</div>
				</div>
			</div>

			<Separator />

			{/* Properties */}
			<div>
				<h3 className="text-sm font-semibold mb-2">Properties</h3>
				<PropertyMappingTable mappings={edgeType.property_mappings} />
			</div>

			<Separator />

			{/* Constraints */}
			<div>
				<h3 className="text-sm font-semibold mb-2">Constraints on this type</h3>
				<ConstraintTable constraints={filteredConstraints} />
			</div>

			<Separator />

			{/* Indexes */}
			<div>
				<h3 className="text-sm font-semibold mb-2">Indexes on this type</h3>
				<IndexTable indexes={filteredIndexes} />
			</div>
		</div>
	);
}
