import {
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
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@invana/ui";
import { ApiError } from "@invana-studio/core";
import { FormError } from "@invana-studio/ui";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { modelsApi } from "../../api";
import { useUpdateModelMutation } from "../../queries";
import type { GraphModelSummary } from "../../types";

interface Props {
	open: boolean;
	username: string;
	graphSlug: string;
	/** The model to edit; null keeps the dialog closed. */
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
		enabled: open && model !== null,
	});

	useEffect(() => {
		if (!open) return;
		if (full) {
			setName(full.name);
			setDescription(full.description);
			setValidationMode(full.validation_mode as "strict" | "permissive");
		}
		setError(null);
	}, [open, full]);

	const submitting = update.isPending;

	async function onSubmit(e: React.FormEvent) {
		e.preventDefault();
		setError(null);
		try {
			if (!model) return;
			await update.mutateAsync({
				id: model.id,
				data: { name, description, validation_mode: validationMode },
			});
			onClose();
		} catch (err) {
			const message =
				err instanceof ApiError ? err.message : "Failed to save model.";
			setError(message);
			toast.error(message);
		}
	}

	return (
		<Dialog open={open && model !== null} onOpenChange={(o) => !o && onClose()}>
			<DialogContent>
				<form onSubmit={onSubmit}>
					<DialogHeader>
						<DialogTitle>Edit model</DialogTitle>
						<DialogDescription>Update this model's metadata.</DialogDescription>
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
							{submitting ? "Saving…" : "Save changes"}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
