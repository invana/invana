import {
	Checkbox,
	Input,
	Label,
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
	Textarea,
} from "@invana/forms";
import {
	Button,
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@invana/ui";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { FormError } from "../../../../components/forms/FormError";
import {
	useCreateEdgeTypeMutation,
	useUpdateEdgeTypeMutation,
} from "../../../../hooks/queries/useModels";
import { ApiError, suppressActionToast } from "../../../../services/api/client";
import type { Multiplicity } from "../../../../types/models";
import type {
	EdgeTypeResponse,
	NodeTypeResponse,
} from "../../../../types/schemas";
import type { ModelEditCtx } from "./editing";

const MULTIPLICITIES: Multiplicity[] = [
	"MULTI",
	"SIMPLE",
	"ONE2MANY",
	"MANY2ONE",
	"ONE2ONE",
];

interface Props {
	open: boolean;
	ctx: ModelEditCtx;
	/** null → create; set → edit this edge type's metadata. */
	edgeType: EdgeTypeResponse | null;
	/**
	 * When creating from a canvas Connect gesture, seeds the source/target
	 * checklists with the dragged endpoints' node-type names. Ignored when editing.
	 */
	prefill?: { source: string[]; target: string[] };
	existingNodeTypes: NodeTypeResponse[];
	onClose: () => void;
}

function NodeTypeChecklist({
	idPrefix,
	label,
	all,
	selected,
	onToggle,
}: {
	idPrefix: string;
	label: string;
	all: NodeTypeResponse[];
	selected: string[];
	onToggle: (name: string) => void;
}) {
	return (
		<div className="space-y-2">
			<Label>{label}</Label>
			{all.length === 0 ? (
				<p className="text-xs text-muted-foreground">
					Create node types first to constrain endpoints.
				</p>
			) : (
				<div className="flex flex-col gap-1 max-h-32 overflow-auto rounded-md border border-border p-2">
					{all.map((n) => (
						<div key={n.id} className="flex items-center gap-2 text-sm">
							<Checkbox
								id={`${idPrefix}-${n.id}`}
								checked={selected.includes(n.name)}
								onCheckedChange={() => onToggle(n.name)}
							/>
							<Label
								htmlFor={`${idPrefix}-${n.id}`}
								className="cursor-pointer font-normal"
							>
								{n.name}
							</Label>
						</div>
					))}
				</div>
			)}
		</div>
	);
}

export function EdgeTypeFormDialog({
	open,
	ctx,
	edgeType,
	prefill,
	existingNodeTypes,
	onClose,
}: Props) {
	const isEdit = edgeType !== null;
	const create = useCreateEdgeTypeMutation(ctx.username, ctx.graphSlug);
	const update = useUpdateEdgeTypeMutation(ctx.username, ctx.graphSlug);

	const [name, setName] = useState("");
	const [description, setDescription] = useState("");
	const [multiplicity, setMultiplicity] = useState<Multiplicity>("MULTI");
	const [source, setSource] = useState<string[]>([]);
	const [target, setTarget] = useState<string[]>([]);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		if (!open) return;
		setName(edgeType?.name ?? "");
		setDescription(edgeType?.description ?? "");
		setMultiplicity((edgeType?.multiplicity as Multiplicity) ?? "MULTI");
		// Editing → load the edge's endpoints; creating → seed from the canvas
		// gesture's prefill (empty when opened from the SchemaNav "+").
		setSource(edgeType?.source_node_types ?? prefill?.source ?? []);
		setTarget(edgeType?.target_node_types ?? prefill?.target ?? []);
		setError(null);
	}, [open, edgeType, prefill]);

	const submitting = create.isPending || update.isPending;

	const toggle = (
		setter: React.Dispatch<React.SetStateAction<string[]>>,
		name: string,
	) =>
		setter((prev) =>
			prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name],
		);

	async function onSubmit(e: React.FormEvent) {
		e.preventDefault();
		setError(null);
		const data = {
			name,
			description,
			multiplicity,
			source_node_types: source,
			target_node_types: target,
		};
		try {
			// Draft edits stage silently (RFC-029) — suppress the per-request toast;
			// Publish is the single commit.
			await suppressActionToast(async () => {
				if (isEdit && edgeType) {
					await update.mutateAsync({
						modelId: ctx.modelId,
						versionId: ctx.versionId,
						typeId: edgeType.id,
						data,
					});
				} else {
					await create.mutateAsync({
						modelId: ctx.modelId,
						versionId: ctx.versionId,
						data,
					});
				}
			});
			onClose();
		} catch (err) {
			const message =
				err instanceof ApiError ? err.message : "Failed to save edge type.";
			setError(message);
			toast.error(message);
		}
	}

	return (
		<Dialog open={open} onOpenChange={(o) => !o && onClose()}>
			<DialogContent>
				<form onSubmit={onSubmit}>
					<DialogHeader>
						<DialogTitle>
							{isEdit ? "Edit edge type" : "New edge type"}
						</DialogTitle>
					</DialogHeader>
					<div className="space-y-4 pt-4">
						<div className="space-y-2">
							<Label htmlFor="etName">Name</Label>
							<Input
								id="etName"
								required
								value={name}
								onChange={(e) => setName(e.target.value)}
							/>
						</div>
						<div className="space-y-2">
							<Label htmlFor="etDesc">Description</Label>
							<Textarea
								id="etDesc"
								value={description}
								onChange={(e) => setDescription(e.target.value)}
							/>
						</div>
						<div className="space-y-2">
							<Label htmlFor="etMult">Multiplicity</Label>
							<Select
								value={multiplicity}
								onValueChange={(v) => setMultiplicity(v as Multiplicity)}
							>
								<SelectTrigger id="etMult">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{MULTIPLICITIES.map((m) => (
										<SelectItem key={m} value={m}>
											{m}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
						<NodeTypeChecklist
							idPrefix="src"
							label="Source node types"
							all={existingNodeTypes}
							selected={source}
							onToggle={(n) => toggle(setSource, n)}
						/>
						<NodeTypeChecklist
							idPrefix="tgt"
							label="Target node types"
							all={existingNodeTypes}
							selected={target}
							onToggle={(n) => toggle(setTarget, n)}
						/>
					</div>
					<FormError error={error} className="mt-4" />
					<DialogFooter>
						<Button variant="ghost" onClick={onClose} type="button">
							Cancel
						</Button>
						<Button type="submit" disabled={submitting}>
							{submitting ? "Saving…" : isEdit ? "Save changes" : "Create"}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
