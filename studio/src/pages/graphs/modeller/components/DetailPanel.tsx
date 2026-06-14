import type {
	ConstraintResponse,
	EdgeTypeResponse,
	IndexResponse,
	NodeTypeResponse,
	PropertyKeyResponse,
} from "../../../../types/schemas";
import { ConstraintTable } from "./ConstraintTable";
import { EdgeTypeDetail } from "./EdgeTypeDetail";
import { IndexTable } from "./IndexTable";
import { NoSelectionPlaceholder } from "./NoSelectionPlaceholder";
import { NodeTypeDetail } from "./NodeTypeDetail";
import { PropertyKeyTable } from "./PropertyKeyTable";
import type { ModelEditCtx } from "./editing";

export type SelectedItem =
	| { kind: "node-type"; id: string }
	| { kind: "edge-type"; id: string }
	| { kind: "property-keys" }
	| { kind: "constraints" }
	| { kind: "indexes" }
	| null;

interface Props {
	selected: SelectedItem;
	nodeTypes: NodeTypeResponse[];
	edgeTypes: EdgeTypeResponse[];
	propertyKeys: PropertyKeyResponse[];
	constraints: ConstraintResponse[];
	indexes: IndexResponse[];
	editable?: boolean;
	ctx?: ModelEditCtx;
	/** Read-only published model that can be drafted to edit (not the system model). */
	canEditViaDraft?: boolean;
	/** A draft-creation is in flight (disables the affordance). */
	creatingDraft?: boolean;
	/** Drafts the model and switches to the editable PropertyEditor for this type. */
	onEditViaDraft?: () => void;
	onEditNodeType?: (nodeType: NodeTypeResponse) => void;
	onDeleteNodeType?: (id: string) => void;
	onEditEdgeType?: (edgeType: EdgeTypeResponse) => void;
	onDeleteEdgeType?: (id: string) => void;
}

export function DetailPanel({
	selected,
	nodeTypes,
	edgeTypes,
	propertyKeys,
	constraints,
	indexes,
	editable = false,
	ctx,
	canEditViaDraft = false,
	creatingDraft = false,
	onEditViaDraft,
	onEditNodeType,
	onDeleteNodeType,
	onEditEdgeType,
	onDeleteEdgeType,
}: Props) {
	if (!selected) {
		return <NoSelectionPlaceholder />;
	}

	if (selected.kind === "node-type") {
		const nodeType = nodeTypes.find((n) => n.id === selected.id);
		if (!nodeType) return <NoSelectionPlaceholder />;
		return (
			<NodeTypeDetail
				nodeType={nodeType}
				constraints={constraints}
				indexes={indexes}
				editable={editable}
				ctx={ctx}
				canEditViaDraft={canEditViaDraft}
				creatingDraft={creatingDraft}
				onEditViaDraft={onEditViaDraft}
				propertyKeys={propertyKeys}
				onEdit={() => onEditNodeType?.(nodeType)}
				onDelete={() => onDeleteNodeType?.(nodeType.id)}
			/>
		);
	}

	if (selected.kind === "edge-type") {
		const edgeType = edgeTypes.find((e) => e.id === selected.id);
		if (!edgeType) return <NoSelectionPlaceholder />;
		return (
			<EdgeTypeDetail
				edgeType={edgeType}
				constraints={constraints}
				indexes={indexes}
				editable={editable}
				ctx={ctx}
				canEditViaDraft={canEditViaDraft}
				creatingDraft={creatingDraft}
				onEditViaDraft={onEditViaDraft}
				propertyKeys={propertyKeys}
				onEdit={() => onEditEdgeType?.(edgeType)}
				onDelete={() => onDeleteEdgeType?.(edgeType.id)}
			/>
		);
	}

	if (selected.kind === "property-keys") {
		return (
			<div className="flex flex-col gap-4">
				<h2 className="text-xl font-semibold">Property Keys</h2>
				<PropertyKeyTable
					propertyKeys={propertyKeys}
					nodeTypes={nodeTypes}
					edgeTypes={edgeTypes}
					editable={editable}
					ctx={ctx}
				/>
			</div>
		);
	}

	if (selected.kind === "constraints") {
		return (
			<div className="flex flex-col gap-4">
				<h2 className="text-xl font-semibold">Constraints</h2>
				<ConstraintTable constraints={constraints} />
			</div>
		);
	}

	if (selected.kind === "indexes") {
		return (
			<div className="flex flex-col gap-4">
				<h2 className="text-xl font-semibold">Indexes</h2>
				<IndexTable indexes={indexes} />
			</div>
		);
	}

	return <NoSelectionPlaceholder />;
}
