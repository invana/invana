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
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@invana/ui";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { FormError } from "../../../../components/forms/FormError";
import { useGraphConnectionQuery } from "../../../../hooks/queries/useGraphs";
import {
	useCreatePropertyKeyMutation,
	useUpdatePropertyKeyMutation,
} from "../../../../hooks/queries/useModels";
import { ApiError } from "../../../../services/api/client";
import type { PropertyKeyResponse } from "../../../../types/schemas";
import type { ModelEditCtx } from "./editing";
import { propertyTypeOptions } from "./editing";

type Cardinality = "SINGLE" | "LIST" | "SET";

interface Props {
	open: boolean;
	ctx: ModelEditCtx;
	/** null → create a new global property key; set → edit it. */
	propertyKey: PropertyKeyResponse | null;
	/** Shown when editing — a key is shared across every type that uses it. */
	usedByCount?: number;
	onClose: () => void;
}

export function PropertyKeyFormDialog({
	open,
	ctx,
	propertyKey,
	usedByCount = 0,
	onClose,
}: Props) {
	const isEdit = propertyKey !== null;
	const create = useCreatePropertyKeyMutation(ctx.username, ctx.graphSlug);
	const update = useUpdatePropertyKeyMutation(ctx.username, ctx.graphSlug);
	const { data: connection } = useGraphConnectionQuery(
		ctx.username,
		ctx.graphSlug,
	);
	// Only the property types the bound backend supports for its version (RFC-022).
	const typeOptions = propertyTypeOptions(connection?.supported_property_types);

	const [name, setName] = useState("");
	const [type, setType] = useState("string");
	const [cardinality, setCardinality] = useState<Cardinality>("SINGLE");
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		if (!open) return;
		setName(propertyKey?.name ?? "");
		setType(propertyKey?.type ?? "string");
		setCardinality(propertyKey?.value_cardinality ?? "SINGLE");
		setError(null);
	}, [open, propertyKey]);

	const submitting = create.isPending || update.isPending;

	async function onSubmit(e: React.FormEvent) {
		e.preventDefault();
		setError(null);
		try {
			if (isEdit && propertyKey) {
				await update.mutateAsync({
					modelId: ctx.modelId,
					versionId: ctx.versionId,
					keyId: propertyKey.id,
					data: { name, type, value_cardinality: cardinality },
				});
				toast.success("Property key updated.");
			} else {
				await create.mutateAsync({
					modelId: ctx.modelId,
					versionId: ctx.versionId,
					data: { name, type, value_cardinality: cardinality },
				});
				toast.success("Property key created.");
			}
			onClose();
		} catch (err) {
			const message =
				err instanceof ApiError ? err.message : "Failed to save property key.";
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
							{isEdit ? "Edit property key" : "New property key"}
						</DialogTitle>
						{isEdit && usedByCount > 1 && (
							<DialogDescription>
								This key is used by {usedByCount} types in this draft — changes
								apply everywhere it's used.
							</DialogDescription>
						)}
					</DialogHeader>
					<div className="space-y-4 pt-4">
						<div className="space-y-2">
							<Label htmlFor="pkName">Name</Label>
							<Input
								id="pkName"
								required
								value={name}
								onChange={(e) => setName(e.target.value)}
							/>
						</div>
						<div className="space-y-2">
							<Label htmlFor="pkType">Data type</Label>
							<Select value={type} onValueChange={setType}>
								<SelectTrigger id="pkType">
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
						<div className="space-y-2">
							<Label htmlFor="pkCardinality">Cardinality</Label>
							<Select
								value={cardinality}
								onValueChange={(v) => setCardinality(v as Cardinality)}
							>
								<SelectTrigger id="pkCardinality">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="SINGLE">SINGLE</SelectItem>
									<SelectItem value="LIST">LIST</SelectItem>
									<SelectItem value="SET">SET</SelectItem>
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
							{submitting ? "Saving…" : isEdit ? "Save changes" : "Create"}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
