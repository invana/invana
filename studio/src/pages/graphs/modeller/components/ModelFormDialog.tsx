import {
	Button,
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	Input,
	Label,
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
	Textarea,
} from "@invana/ui";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { FormError } from "../../../../components/forms/FormError";
import {
	useCreateModelMutation,
	useUpdateModelMutation,
} from "../../../../hooks/queries/useModels";
import { ApiError } from "../../../../services/api/client";
import { modelsApi } from "../../../../services/api/models";
import type { GraphModelSummary } from "../../../../types/models";

interface Props {
	open: boolean;
	username: string;
	graphSlug: string;
	/** null → create a new model; set → edit this model. */
	model: GraphModelSummary | null;
	onClose: () => void;
}

export function ModelFormDialog({
	open,
	username,
	graphSlug,
	model,
	onClose,
}: Props) {
	const isEdit = model !== null;
	const create = useCreateModelMutation(username, graphSlug);
	const update = useUpdateModelMutation(username, graphSlug);

	const [name, setName] = useState("");
	const [description, setDescription] = useState("");
	const [validationMode, setValidationMode] = useState<"strict" | "permissive">(
		"strict",
	);
	const [error, setError] = useState<string | null>(null);

	// On edit, fetch the full model so description / validation_mode prefill.
	const { data: full } = useQuery({
		queryKey: ["models", username, graphSlug, model?.id, "detail"],
		queryFn: () => modelsApi.get(username, graphSlug, model?.id as string),
		enabled: open && isEdit,
	});

	useEffect(() => {
		if (!open) return;
		if (isEdit && full) {
			setName(full.name);
			setDescription(full.description);
			setValidationMode(full.validation_mode as "strict" | "permissive");
		} else if (!isEdit) {
			setName("");
			setDescription("");
			setValidationMode("strict");
		}
		setError(null);
	}, [open, isEdit, full]);

	const submitting = create.isPending || update.isPending;

	async function onSubmit(e: React.FormEvent) {
		e.preventDefault();
		setError(null);
		try {
			if (isEdit && model) {
				await update.mutateAsync({
					id: model.id,
					data: {
						name,
						description,
						validation_mode: validationMode,
					},
				});
				toast.success("Model updated.");
			} else {
				await create.mutateAsync({
					name,
					description,
					validation_mode: validationMode,
				});
				toast.success("Model created.");
			}
			onClose();
		} catch (err) {
			const message =
				err instanceof ApiError ? err.message : "Failed to save model.";
			setError(message);
			toast.error(message);
		}
	}

	return (
		<Dialog open={open} onOpenChange={(o) => !o && onClose()}>
			<DialogContent>
				<form onSubmit={onSubmit}>
					<DialogHeader>
						<DialogTitle>{isEdit ? "Edit model" : "New model"}</DialogTitle>
						<DialogDescription>
							{isEdit
								? "Update this model's metadata."
								: "A graph model groups the node and edge types that data is validated against. It starts as a draft you can author, then publish."}
						</DialogDescription>
					</DialogHeader>
					<div className="space-y-4 pt-4">
						<div className="space-y-2">
							<Label htmlFor="modelName">Name</Label>
							<Input
								id="modelName"
								required
								value={name}
								onChange={(e) => setName(e.target.value)}
							/>
						</div>
						<div className="space-y-2">
							<Label htmlFor="modelDesc">Description</Label>
							<Textarea
								id="modelDesc"
								value={description}
								onChange={(e) => setDescription(e.target.value)}
							/>
						</div>
						<div className="space-y-2">
							<Label htmlFor="modelValidation">Validation mode</Label>
							<Select
								value={validationMode}
								onValueChange={(v) =>
									setValidationMode(v as "strict" | "permissive")
								}
							>
								<SelectTrigger id="modelValidation">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="strict">strict</SelectItem>
									<SelectItem value="permissive">permissive</SelectItem>
								</SelectContent>
							</Select>
						</div>
					</div>
					<FormError error={error} className="mt-4" />
					<DialogFooter>
						<Button variant="ghost" onClick={onClose} type="button">
							Cancel
						</Button>
						<Button type="submit" disabled={submitting}>
							{submitting
								? "Saving…"
								: isEdit
									? "Save changes"
									: "Create model"}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
