import { Badge, Button, Separator } from "@invana/ui";
import { Pencil, Trash2 } from "lucide-react";
import type {
	ConstraintResponse,
	IndexResponse,
	NodeTypeResponse,
	PropertyKeyResponse,
} from "../../../../types/schemas";
import { ConstraintTable } from "./ConstraintTable";
import { IndexTable } from "./IndexTable";
import { PropertyEditor } from "./PropertyEditor";
import { PropertyMappingTable } from "./PropertyMappingTable";
import type { ModelEditCtx } from "./editing";

interface Props {
	nodeType: NodeTypeResponse;
	constraints: ConstraintResponse[];
	indexes: IndexResponse[];
	editable?: boolean;
	ctx?: ModelEditCtx;
	/** Read-only published model that can be drafted to edit (not the system model). */
	canEditViaDraft?: boolean;
	/** A draft-creation is in flight. */
	creatingDraft?: boolean;
	/** Drafts the model and switches to the editable PropertyEditor for this type. */
	onEditViaDraft?: () => void;
	propertyKeys?: PropertyKeyResponse[];
	onEdit?: () => void;
	onDelete?: () => void;
}

export function NodeTypeDetail({
	nodeType,
	constraints,
	indexes,
	editable = false,
	ctx,
	canEditViaDraft = false,
	creatingDraft = false,
	onEditViaDraft,
	propertyKeys = [],
	onEdit,
	onDelete,
}: Props) {
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
				<div className="flex items-center justify-between mb-2">
					<h3 className="font-semibold">Properties</h3>
					{!editable && canEditViaDraft && (
						<Button
							variant="outline"
							size="sm"
							onClick={onEditViaDraft}
							disabled={creatingDraft}
							title="Create a draft of this model to edit its properties"
						>
							<Pencil className="w-3.5 h-3.5 mr-1" />
							{creatingDraft ? "Creating draft…" : "Create draft to edit"}
						</Button>
					)}
				</div>
				{editable && ctx ? (
					<PropertyEditor
						ctx={ctx}
						kind="node"
						typeId={nodeType.id}
						mappings={nodeType.property_mappings}
						propertyKeys={propertyKeys}
					/>
				) : (
					<PropertyMappingTable mappings={nodeType.property_mappings} />
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
