import { Badge, Button, Separator } from "@invana/ui";
import { Pencil } from "lucide-react";
import type {
	GraphModelResponse,
	GraphModelSummary,
} from "../../../../types/models";

interface Counts {
	nodeTypes: number;
	edgeTypes: number;
	propertyKeys: number;
	constraints: number;
	indexes: number;
}

interface Props {
	/** Falls back to the list summary while the full detail (validation, dates) loads. */
	model: GraphModelResponse | GraphModelSummary;
	counts: Counts;
	/** Whether the model can be edited (non-system) — shows the Edit affordance. */
	canEdit?: boolean;
	onEdit?: () => void;
}

const fmtDateTime = (iso: string) =>
	new Date(iso).toLocaleString(undefined, {
		month: "short",
		day: "numeric",
		year: "numeric",
		hour: "numeric",
		minute: "2-digit",
	});

function MetaRow({ label, value }: { label: string; value: React.ReactNode }) {
	return (
		<div className="flex items-baseline justify-between gap-4">
			<span className="text-muted-foreground">{label}</span>
			<span className="text-right">{value}</span>
		</div>
	);
}

/** Read-only metadata overview shown in the Details panel when no type is selected. */
export function ModelOverview({ model, counts, canEdit, onEdit }: Props) {
	const isSystem = model.origin === "introspected";
	// `validation_mode`, `created_at`, `yaml_path` only exist on the full detail
	// response; the list summary lacks them (shown as — until the detail loads).
	const full = "validation_mode" in model ? model : null;

	return (
		<div className="flex flex-col gap-6">
			{/* Header */}
			<div className="flex flex-col gap-1">
				<div className="flex items-center gap-2">
					<span className="text-xl font-semibold">{model.name}</span>
					{isSystem ? (
						<Badge variant="secondary">system</Badge>
					) : model.status === "draft" ? (
						<Badge variant="outline">draft</Badge>
					) : (
						<Badge variant="secondary">{model.status}</Badge>
					)}
					{canEdit && onEdit && (
						<Button
							variant="ghost"
							size="sm"
							className="ml-auto"
							onClick={onEdit}
						>
							<Pencil className="w-3.5 h-3.5 mr-1" />
							Edit
						</Button>
					)}
				</div>
				<p className="text-muted-foreground">
					{model.description ||
						(isSystem ? "Live database schema." : "No description.")}
				</p>
			</div>

			<Separator />

			{/* Metadata */}
			<div className="flex flex-col gap-2">
				<MetaRow
					label="Origin"
					value={
						isSystem
							? "introspected"
							: model.origin === "yaml"
								? "yaml"
								: "studio"
					}
				/>
				<MetaRow label="Validation" value={full?.validation_mode ?? "—"} />
				<MetaRow
					label="Current version"
					value={model.active_version?.version ?? "—"}
				/>
				<MetaRow
					label="Created"
					value={full ? fmtDateTime(full.created_at) : "—"}
				/>
				<MetaRow label="Updated" value={fmtDateTime(model.updated_at)} />
				{full?.yaml_path && (
					<MetaRow label="YAML path" value={full.yaml_path} />
				)}
			</div>

			<Separator />

			{/* Contents */}
			<div className="flex flex-col gap-2">
				<h3 className="font-semibold">Contents</h3>
				<MetaRow label="Node types" value={counts.nodeTypes} />
				<MetaRow label="Edge types" value={counts.edgeTypes} />
				<MetaRow label="Property keys" value={counts.propertyKeys} />
				<MetaRow label="Constraints" value={counts.constraints} />
				<MetaRow label="Indexes" value={counts.indexes} />
			</div>
		</div>
	);
}
