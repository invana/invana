import { Badge, Button, Separator } from "@invana/ui";
import { Pencil, Trash2 } from "lucide-react";
import type {
	ConstraintResponse,
	EdgeTypeResponse,
	IndexResponse,
	PropertyKeyResponse,
} from "../../../../types/schemas";
import { ConstraintTable } from "./ConstraintTable";
import { IndexTable } from "./IndexTable";
import { PropertyEditor } from "./PropertyEditor";
import { PropertyMappingTable } from "./PropertyMappingTable";
import type { ModelEditCtx } from "./editing";

interface Props {
	edgeType: EdgeTypeResponse;
	constraints: ConstraintResponse[];
	indexes: IndexResponse[];
	editable?: boolean;
	ctx?: ModelEditCtx;
	propertyKeys?: PropertyKeyResponse[];
	onEdit?: () => void;
	onDelete?: () => void;
}

export function EdgeTypeDetail({
	edgeType,
	constraints,
	indexes,
	editable = false,
	ctx,
	propertyKeys = [],
	onEdit,
	onDelete,
}: Props) {
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
					<span className="text-xl font-semibold">{edgeType.name}</span>
					<Badge variant="secondary">edge type</Badge>
					{editable && (
						<div className="ml-auto flex items-center gap-1">
							<Button variant="ghost" size="sm" onClick={onEdit}>
								<Pencil className="w-3.5 h-3.5 mr-1" />
								Edit
							</Button>
							<Button variant="ghost" size="sm" onClick={onDelete}>
								<Trash2 className="w-3.5 h-3.5" />
							</Button>
						</div>
					)}
				</div>
				{edgeType.description ? (
					<p className="text-muted-foreground">{edgeType.description}</p>
				) : (
					<p className="text-muted-foreground">—</p>
				)}
				<div className="flex gap-4 text-muted-foreground mt-1">
					<span>
						<span className="font-medium">multiplicity:</span>{" "}
						{edgeType.multiplicity}
					</span>
				</div>
				<div className="flex gap-4 mt-1 flex-wrap">
					<div className="flex items-center gap-1">
						<span className="text-muted-foreground font-medium">source:</span>
						{edgeType.source_node_types.length > 0 ? (
							edgeType.source_node_types.map((t) => (
								<Badge key={t} variant="outline">
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
								<Badge key={t} variant="outline">
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
				<h3 className="font-semibold mb-2">Properties</h3>
				{editable && ctx ? (
					<PropertyEditor
						ctx={ctx}
						kind="edge"
						typeId={edgeType.id}
						mappings={edgeType.property_mappings}
						propertyKeys={propertyKeys}
					/>
				) : (
					<PropertyMappingTable mappings={edgeType.property_mappings} />
				)}
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
