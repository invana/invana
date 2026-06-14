import {
	Input,
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@invana/forms";
import {
	Button,
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@invana/ui";
import { Check, Pencil, Plus, Trash2, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useGraphConnectionQuery } from "../../../../hooks/queries/useGraphs";
import {
	useCreatePropertyKeyMutation,
	useUpdateEdgeTypeMutation,
	useUpdateNodeTypeMutation,
	useUpdatePropertyKeyMutation,
} from "../../../../hooks/queries/useModels";
import { ApiError, suppressActionToast } from "../../../../services/api/client";
import type { TypePropertyMappingCreate } from "../../../../types/models";
import type {
	PropertyKeyResponse,
	TypePropertyMappingResponse,
} from "../../../../types/schemas";
import type { ModelEditCtx } from "./editing";
import { propertyTypeOptions } from "./editing";

type Cardinality = "SINGLE" | "LIST" | "SET";
const CARDINALITIES: Cardinality[] = ["SINGLE", "LIST", "SET"];

interface Props {
	ctx: ModelEditCtx;
	kind: "node" | "edge";
	typeId: string;
	mappings: TypePropertyMappingResponse[];
	propertyKeys: PropertyKeyResponse[];
}

/** Current mappings as a create-list, so we can full-replace via PATCH. */
function toCreateList(
	mappings: TypePropertyMappingResponse[],
): TypePropertyMappingCreate[] {
	return mappings.map((m) => ({
		property_key: m.property_key.name,
		default_value: m.default_value,
		sort_order: m.sort_order,
		validation_rules: m.validation_rules.map((r) => ({
			rule_type: r.rule_type,
			params: r.params,
		})),
	}));
}

interface DraftRow {
	name: string;
	type: string;
	cardinality: Cardinality;
}

const EMPTY_DRAFT: DraftRow = {
	name: "",
	type: "string",
	cardinality: "SINGLE",
};

/**
 * Inline property editor — no modals. Each row edits in place (name / data type /
 * cardinality become fields with Save / Cancel), and "Add property" reveals an
 * inline new-property row at the bottom. Editing a property edits its shared
 * property *key*; adding either attaches an existing key (matched by name) or
 * creates a new one, then patches this type's mapping list.
 */
export function PropertyEditor({
	ctx,
	kind,
	typeId,
	mappings,
	propertyKeys,
}: Props) {
	const updateNode = useUpdateNodeTypeMutation(ctx.username, ctx.graphSlug);
	const updateEdge = useUpdateEdgeTypeMutation(ctx.username, ctx.graphSlug);
	const createKey = useCreatePropertyKeyMutation(ctx.username, ctx.graphSlug);
	const updateKey = useUpdatePropertyKeyMutation(ctx.username, ctx.graphSlug);
	const { data: connection } = useGraphConnectionQuery(
		ctx.username,
		ctx.graphSlug,
	);
	// Only the property types the bound backend supports for its version (RFC-022).
	const typeOptions = propertyTypeOptions(connection?.supported_property_types);

	// Which existing row is in edit mode (by mapping id), the in-flight draft, and
	// whether the inline add-row is showing. Only one row is ever editable at once.
	const [editingId, setEditingId] = useState<string | null>(null);
	const [adding, setAdding] = useState(false);
	const [draft, setDraft] = useState<DraftRow>(EMPTY_DRAFT);

	const busy =
		updateNode.isPending ||
		updateEdge.isPending ||
		createKey.isPending ||
		updateKey.isPending;

	const patchMappings = async (next: TypePropertyMappingCreate[]) => {
		const args = {
			modelId: ctx.modelId,
			versionId: ctx.versionId,
			typeId,
			data: { property_mappings: next },
		};
		if (kind === "node") await updateNode.mutateAsync(args);
		else await updateEdge.mutateAsync(args);
	};

	function startAdd() {
		setEditingId(null);
		setDraft(EMPTY_DRAFT);
		setAdding(true);
	}

	function startEdit(m: TypePropertyMappingResponse) {
		setAdding(false);
		setEditingId(m.id);
		setDraft({
			name: m.property_key.name,
			type: m.property_key.type,
			cardinality: m.property_key.value_cardinality as Cardinality,
		});
	}

	function cancel() {
		setEditingId(null);
		setAdding(false);
		setDraft(EMPTY_DRAFT);
	}

	async function saveEdit(keyId: string) {
		const name = draft.name.trim();
		if (!name) return;
		try {
			// Property gestures are orchestrated over generic key/type endpoints, so
			// suppress their per-request toasts and show one summary (RFC-028 Decision #6).
			await suppressActionToast(() =>
				updateKey.mutateAsync({
					modelId: ctx.modelId,
					versionId: ctx.versionId,
					keyId,
					data: {
						name,
						type: draft.type,
						value_cardinality: draft.cardinality,
					},
				}),
			);
			toast.success("Property updated.");
			cancel();
		} catch (err) {
			toast.error(
				err instanceof ApiError ? err.message : "Failed to update property.",
			);
		}
	}

	async function saveAdd() {
		const name = draft.name.trim();
		if (!name) return;
		if (mappings.some((m) => m.property_key.name === name)) {
			toast.error("That property is already on this type.");
			return;
		}
		try {
			// Adding a property fans out to two requests (create key + patch the
			// type's mappings); suppress both per-request toasts and show one
			// summary (RFC-028 Decision #6).
			await suppressActionToast(async () => {
				// Reuse an existing key of the same name (keys are shared across types);
				// otherwise create a new one with the chosen type + cardinality.
				const existing = propertyKeys.find((pk) => pk.name === name);
				if (!existing) {
					await createKey.mutateAsync({
						modelId: ctx.modelId,
						versionId: ctx.versionId,
						data: {
							name,
							type: draft.type,
							value_cardinality: draft.cardinality,
						},
					});
				}
				await patchMappings([
					...toCreateList(mappings),
					{ property_key: name, sort_order: mappings.length },
				]);
			});
			toast.success("Property added.");
			cancel();
		} catch (err) {
			toast.error(
				err instanceof ApiError ? err.message : "Failed to add property.",
			);
		}
	}

	async function onRemove(keyName: string) {
		try {
			await suppressActionToast(() =>
				patchMappings(
					toCreateList(mappings.filter((m) => m.property_key.name !== keyName)),
				),
			);
			toast.success("Property removed.");
		} catch (err) {
			toast.error(
				err instanceof ApiError ? err.message : "Failed to remove property.",
			);
		}
	}

	const showTable = mappings.length > 0 || adding;

	return (
		<div className="flex flex-col gap-2">
			{showTable ? (
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead>Name</TableHead>
							<TableHead>Data type</TableHead>
							<TableHead>Cardinality</TableHead>
							<TableHead className="w-24 text-right">Actions</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{mappings.map((m) =>
							editingId === m.id ? (
								<EditableRow
									key={m.id}
									draft={draft}
									typeOptions={typeOptions}
									busy={busy}
									onChange={setDraft}
									onSave={() => saveEdit(m.property_key.id)}
									onCancel={cancel}
								/>
							) : (
								<TableRow key={m.id}>
									<TableCell className="font-mono">
										{m.property_key.name}
									</TableCell>
									<TableCell>{m.property_key.type}</TableCell>
									<TableCell>{m.property_key.value_cardinality}</TableCell>
									<TableCell className="text-right">
										<Button
											variant="ghost"
											size="sm"
											title="Edit property"
											disabled={busy || adding || editingId !== null}
											onClick={() => startEdit(m)}
										>
											<Pencil className="w-3.5 h-3.5" />
										</Button>
										<Button
											variant="ghost"
											size="sm"
											title="Remove from this type"
											disabled={busy || editingId !== null}
											onClick={() => onRemove(m.property_key.name)}
										>
											<Trash2 className="w-3.5 h-3.5" />
										</Button>
									</TableCell>
								</TableRow>
							),
						)}
						{adding && (
							<EditableRow
								draft={draft}
								typeOptions={typeOptions}
								busy={busy}
								autoFocus
								onChange={setDraft}
								onSave={saveAdd}
								onCancel={cancel}
							/>
						)}
					</TableBody>
				</Table>
			) : (
				<p className="text-muted-foreground py-2">No properties defined.</p>
			)}

			{!adding && editingId === null && (
				<div>
					<Button variant="outline" size="sm" onClick={startAdd}>
						<Plus className="w-3.5 h-3.5 mr-1" />
						Add property
					</Button>
				</div>
			)}
		</div>
	);
}

/** One inline-editable row: name input + type/cardinality selects + Save/Cancel. */
function EditableRow({
	draft,
	typeOptions,
	busy,
	autoFocus = false,
	onChange,
	onSave,
	onCancel,
}: {
	draft: DraftRow;
	typeOptions: string[];
	busy: boolean;
	autoFocus?: boolean;
	onChange: (d: DraftRow) => void;
	onSave: () => void;
	onCancel: () => void;
}) {
	const canSave = draft.name.trim().length > 0 && !busy;
	return (
		<TableRow>
			<TableCell>
				<Input
					autoFocus={autoFocus}
					value={draft.name}
					placeholder="property name"
					className="h-8 font-mono"
					onChange={(e) => onChange({ ...draft, name: e.target.value })}
					onKeyDown={(e) => {
						if (e.key === "Enter" && canSave) onSave();
						if (e.key === "Escape") onCancel();
					}}
				/>
			</TableCell>
			<TableCell>
				<Select
					value={draft.type}
					onValueChange={(v) => onChange({ ...draft, type: v })}
				>
					<SelectTrigger className="h-8">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						{typeOptions.map((t) => (
							<SelectItem key={t} value={t}>
								{t}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</TableCell>
			<TableCell>
				<Select
					value={draft.cardinality}
					onValueChange={(v) =>
						onChange({ ...draft, cardinality: v as Cardinality })
					}
				>
					<SelectTrigger className="h-8">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						{CARDINALITIES.map((c) => (
							<SelectItem key={c} value={c}>
								{c}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</TableCell>
			<TableCell className="text-right">
				<Button
					variant="ghost"
					size="sm"
					title="Save"
					disabled={!canSave}
					onClick={onSave}
				>
					<Check className="w-3.5 h-3.5" />
				</Button>
				<Button
					variant="ghost"
					size="sm"
					title="Cancel"
					disabled={busy}
					onClick={onCancel}
				>
					<X className="w-3.5 h-3.5" />
				</Button>
			</TableCell>
		</TableRow>
	);
}
