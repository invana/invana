import {
	Input,
	Label,
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@invana/forms";
import {
	Button,
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@invana/ui";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { FormError } from "../../../../components/forms/FormError";
import { useGraphConnectionQuery } from "../../../../hooks/queries/useGraphs";
import {
	useCreatePropertyKeyMutation,
	useUpdateEdgeTypeMutation,
	useUpdateNodeTypeMutation,
} from "../../../../hooks/queries/useModels";
import { ApiError } from "../../../../services/api/client";
import type { TypePropertyMappingCreate } from "../../../../types/models";
import type {
	PropertyKeyResponse,
	TypePropertyMappingResponse,
} from "../../../../types/schemas";
import { PropertyKeyFormDialog } from "./PropertyKeyFormDialog";
import type { ModelEditCtx } from "./editing";
import { propertyTypeOptions } from "./editing";

const NEW_KEY = "__new__";

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

export function PropertyEditor({
	ctx,
	kind,
	typeId,
	mappings,
	propertyKeys,
}: Props) {
	const updateNode = useUpdateNodeTypeMutation(ctx.username, ctx.graphSlug);
	const updateEdge = useUpdateEdgeTypeMutation(ctx.username, ctx.graphSlug);
	const [adding, setAdding] = useState(false);
	const [editingKey, setEditingKey] = useState<PropertyKeyResponse | null>(
		null,
	);

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

	async function onRemove(keyName: string) {
		try {
			await patchMappings(
				toCreateList(mappings.filter((m) => m.property_key.name !== keyName)),
			);
			toast.success("Property removed.");
		} catch (err) {
			toast.error(
				err instanceof ApiError ? err.message : "Failed to remove property.",
			);
		}
	}

	// Count how many types share the key being edited (for the global-edit note).
	const usedByCount = (keyName: string) => {
		// We only have this type's mappings here; the table shows it, but the
		// FormDialog note is informational — 1 is the safe minimum.
		return mappings.some((m) => m.property_key.name === keyName) ? 1 : 0;
	};

	return (
		<div className="flex flex-col gap-2">
			{mappings.length === 0 ? (
				<p className="text-muted-foreground py-2">No properties defined.</p>
			) : (
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead>Name</TableHead>
							<TableHead>Data type</TableHead>
							<TableHead>Cardinality</TableHead>
							<TableHead className="w-20 text-right">Actions</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{mappings.map((m) => (
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
										title="Edit property key"
										onClick={() => setEditingKey(m.property_key)}
									>
										<Pencil className="w-3.5 h-3.5" />
									</Button>
									<Button
										variant="ghost"
										size="sm"
										title="Remove from this type"
										onClick={() => onRemove(m.property_key.name)}
									>
										<Trash2 className="w-3.5 h-3.5" />
									</Button>
								</TableCell>
							</TableRow>
						))}
					</TableBody>
				</Table>
			)}

			<div>
				<Button variant="outline" size="sm" onClick={() => setAdding(true)}>
					<Plus className="w-3.5 h-3.5 mr-1" />
					Add property
				</Button>
			</div>

			<AddPropertyDialog
				open={adding}
				ctx={ctx}
				mappings={mappings}
				propertyKeys={propertyKeys}
				onClose={() => setAdding(false)}
				onAdd={patchMappings}
			/>

			<PropertyKeyFormDialog
				open={editingKey !== null}
				ctx={ctx}
				propertyKey={editingKey}
				usedByCount={editingKey ? usedByCount(editingKey.name) : 0}
				onClose={() => setEditingKey(null)}
			/>
		</div>
	);
}

function AddPropertyDialog({
	open,
	ctx,
	mappings,
	propertyKeys,
	onClose,
	onAdd,
}: {
	open: boolean;
	ctx: ModelEditCtx;
	mappings: TypePropertyMappingResponse[];
	propertyKeys: PropertyKeyResponse[];
	onClose: () => void;
	onAdd: (next: TypePropertyMappingCreate[]) => Promise<void>;
}) {
	const createKey = useCreatePropertyKeyMutation(ctx.username, ctx.graphSlug);
	const { data: connection } = useGraphConnectionQuery(
		ctx.username,
		ctx.graphSlug,
	);
	// Only the property types the bound backend supports for its version (RFC-022).
	const typeOptions = propertyTypeOptions(connection?.supported_property_types);
	const [choice, setChoice] = useState<string>(NEW_KEY);
	const [newName, setNewName] = useState("");
	const [newType, setNewType] = useState("string");
	const [submitting, setSubmitting] = useState(false);
	const [error, setError] = useState<string | null>(null);

	// Keys not already attached to this type.
	const available = propertyKeys.filter(
		(pk) => !mappings.some((m) => m.property_key.name === pk.name),
	);

	function reset() {
		setChoice(available.length > 0 ? available[0].name : NEW_KEY);
		setNewName("");
		setNewType("string");
		setError(null);
	}

	async function onSubmit(e: React.FormEvent) {
		e.preventDefault();
		setError(null);
		setSubmitting(true);
		try {
			let keyName: string;
			if (choice === NEW_KEY) {
				await createKey.mutateAsync({
					modelId: ctx.modelId,
					versionId: ctx.versionId,
					data: { name: newName, type: newType },
				});
				keyName = newName;
			} else {
				keyName = choice;
			}
			const next = [
				...toCreateList(mappings),
				{ property_key: keyName, sort_order: mappings.length },
			];
			await onAdd(next);
			toast.success("Property added.");
			onClose();
		} catch (err) {
			const message =
				err instanceof ApiError ? err.message : "Failed to add property.";
			setError(message);
			toast.error(message);
		} finally {
			setSubmitting(false);
		}
	}

	return (
		<Dialog
			open={open}
			onOpenChange={(o) => {
				if (o) reset();
				else onClose();
			}}
		>
			<DialogContent>
				<form onSubmit={onSubmit}>
					<DialogHeader>
						<DialogTitle>Add property</DialogTitle>
					</DialogHeader>
					<div className="space-y-4 pt-4">
						<div className="space-y-2">
							<Label htmlFor="propKey">Property key</Label>
							<Select value={choice} onValueChange={setChoice}>
								<SelectTrigger id="propKey">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{available.map((pk) => (
										<SelectItem key={pk.id} value={pk.name}>
											{pk.name} · {pk.type}
										</SelectItem>
									))}
									<SelectItem value={NEW_KEY}>＋ New property key…</SelectItem>
								</SelectContent>
							</Select>
						</div>
						{choice === NEW_KEY && (
							<div className="flex gap-2">
								<div className="flex-1 space-y-2">
									<Label htmlFor="propName">Name</Label>
									<Input
										id="propName"
										required
										value={newName}
										onChange={(e) => setNewName(e.target.value)}
									/>
								</div>
								<div className="w-40 space-y-2">
									<Label htmlFor="propType">Data type</Label>
									<Select value={newType} onValueChange={setNewType}>
										<SelectTrigger id="propType">
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
								</div>
							</div>
						)}
					</div>
					<FormError error={error} className="mt-4" />
					<DialogFooter>
						<Button variant="ghost" onClick={onClose} type="button">
							Cancel
						</Button>
						<Button type="submit" disabled={submitting}>
							{submitting ? "Adding…" : "Add property"}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
