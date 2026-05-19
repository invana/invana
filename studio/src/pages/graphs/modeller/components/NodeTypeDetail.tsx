import { Badge, Separator } from "@invana/ui";
import type {
	ConstraintResponse,
	IndexResponse,
	NodeTypeResponse,
} from "../../../../types/schemas";
import { ConstraintTable } from "./ConstraintTable";
import { IndexTable } from "./IndexTable";
import { PropertyMappingTable } from "./PropertyMappingTable";

interface Props {
	nodeType: NodeTypeResponse;
	constraints: ConstraintResponse[];
	indexes: IndexResponse[];
}

export function NodeTypeDetail({ nodeType, constraints, indexes }: Props) {
	const filteredConstraints = constraints.filter(
		(c) => c.target_label === nodeType.name,
	);
	const filteredIndexes = indexes.filter(
		(i) => i.target_label === nodeType.name,
	);

	return (
		<div className="flex flex-col gap-6">
			{/* Header */}
			<div className="flex flex-col gap-1">
				<div className="flex items-center gap-2">
					<span className="text-xl font-semibold">{nodeType.name}</span>
					<Badge variant="secondary">node type</Badge>
					{nodeType.is_abstract && <Badge variant="outline">abstract</Badge>}
				</div>
				{nodeType.description ? (
					<p className="text-muted-foreground">{nodeType.description}</p>
				) : (
					<p className="text-muted-foreground">—</p>
				)}
				<div className="flex gap-4 text-muted-foreground mt-1">
					<span>
						<span className="font-medium">parent:</span>{" "}
						{nodeType.parent_type ?? "—"}
					</span>
					<span>
						<span className="font-medium">validation:</span>{" "}
						{nodeType.validation_mode ?? "—"}
					</span>
				</div>
				{nodeType.hierarchy.length > 1 && (
					<p className="text-muted-foreground">
						{nodeType.hierarchy.join(" → ")}
					</p>
				)}
			</div>

			<Separator />

			{/* Properties */}
			<div>
				<h3 className="font-semibold mb-2">Properties</h3>
				<PropertyMappingTable mappings={nodeType.property_mappings} />
			</div>

			<Separator />

			{/* Constraints */}
			<div>
				<h3 className="font-semibold mb-2">Constraints on this type</h3>
				<ConstraintTable constraints={filteredConstraints} />
			</div>

			<Separator />

			{/* Indexes */}
			<div>
				<h3 className="font-semibold mb-2">Indexes on this type</h3>
				<IndexTable indexes={filteredIndexes} />
			</div>
		</div>
	);
}
