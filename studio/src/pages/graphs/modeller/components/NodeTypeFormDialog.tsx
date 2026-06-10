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
	useCreateNodeTypeMutation,
	useUpdateNodeTypeMutation,
} from "../../../../hooks/queries/useModels";
import { ApiError } from "../../../../services/api/client";
import type { NodeTypeResponse } from "../../../../types/schemas";
import type { ModelEditCtx } from "./editing";

const INHERIT = "__inherit__";

interface Props {
	open: boolean;
	ctx: ModelEditCtx;
	/** null → create; set → edit this node type's metadata. */
	nodeType: NodeTypeResponse | null;
	existingNodeTypes: NodeTypeResponse[];
	onClose: () => void;
}

export function NodeTypeFormDialog({
	open,
	ctx,
	nodeType,
	existingNodeTypes,
	onClose,
}: Props) {
	const isEdit = nodeType !== null;
	const create = useCreateNodeTypeMutation(ctx.username, ctx.graphSlug);
	const update = useUpdateNodeTypeMutation(ctx.username, ctx.graphSlug);

	const [name, setName] = useState("");
	const [description, setDescription] = useState("");
	const [parentType, setParentType] = useState<string>(INHERIT);
	const [isAbstract, setIsAbstract] = useState(false);
	const [validationMode, setValidationMode] = useState<string>(INHERIT);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		if (!open) return;
		setName(nodeType?.name ?? "");
		setDescription(nodeType?.description ?? "");
		setParentType(nodeType?.parent_type ?? INHERIT);
		setIsAbstract(nodeType?.is_abstract ?? false);
		setValidationMode(nodeType?.validation_mode ?? INHERIT);
		setError(null);
	}, [open, nodeType]);

	const submitting = create.isPending || update.isPending;
	const parentOptions = existingNodeTypes.filter((n) => n.id !== nodeType?.id);

	async function onSubmit(e: React.FormEvent) {
		e.preventDefault();
		setError(null);
		const data = {
			name,
			description,
			parent_type: parentType === INHERIT ? null : parentType,
			is_abstract: isAbstract,
			validation_mode:
				validationMode === INHERIT
					? null
					: (validationMode as "strict" | "permissive"),
		};
		try {
			if (isEdit && nodeType) {
				await update.mutateAsync({
					modelId: ctx.modelId,
					versionId: ctx.versionId,
					typeId: nodeType.id,
					data,
				});
				toast.success("Node type updated.");
			} else {
				await create.mutateAsync({
					modelId: ctx.modelId,
					versionId: ctx.versionId,
					data,
				});
				toast.success("Node type created.");
			}
			onClose();
		} catch (err) {
			const message =
				err instanceof ApiError ? err.message : "Failed to save node type.";
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
							{isEdit ? "Edit node type" : "New node type"}
						</DialogTitle>
					</DialogHeader>
					<div className="space-y-4 pt-4">
						<div className="space-y-2">
							<Label htmlFor="ntName">Name</Label>
							<Input
								id="ntName"
								required
								value={name}
								onChange={(e) => setName(e.target.value)}
							/>
						</div>
						<div className="space-y-2">
							<Label htmlFor="ntDesc">Description</Label>
							<Textarea
								id="ntDesc"
								value={description}
								onChange={(e) => setDescription(e.target.value)}
							/>
						</div>
						<div className="space-y-2">
							<Label htmlFor="ntParent">Parent type</Label>
							<Select value={parentType} onValueChange={setParentType}>
								<SelectTrigger id="ntParent">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value={INHERIT}>None</SelectItem>
									{parentOptions.map((n) => (
										<SelectItem key={n.id} value={n.name}>
											{n.name}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
						<div className="space-y-2">
							<Label htmlFor="ntValidation">Validation mode</Label>
							<Select value={validationMode} onValueChange={setValidationMode}>
								<SelectTrigger id="ntValidation">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value={INHERIT}>Inherit from model</SelectItem>
									<SelectItem value="strict">strict</SelectItem>
									<SelectItem value="permissive">permissive</SelectItem>
								</SelectContent>
							</Select>
						</div>
						<div className="flex items-center gap-2">
							<Checkbox
								id="ntAbstract"
								checked={isAbstract}
								onCheckedChange={(c) => setIsAbstract(c === true)}
							/>
							<Label htmlFor="ntAbstract">
								Abstract (cannot be instantiated)
							</Label>
						</div>
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
