import { Input, Label, Textarea } from "@invana/forms";
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
import { useUpdateCanvasMutation } from "../../../../hooks/queries/useCanvases";
import { ApiError } from "../../../../services/api/client";
import type { CanvasSummary } from "../../../../types/canvas";

interface Props {
	open: boolean;
	username: string;
	graphSlug: string;
	/** The canvas being edited — title + purpose (instructions). */
	canvas: CanvasSummary | null;
	onClose: () => void;
}

/**
 * Edit a canvas's title and purpose (instructions). Opened from a tab/row
 * header. Creation is handled by "Save current view" in the panel (it needs the
 * live canvas state); this dialog only renames + re-purposes an existing canvas.
 */
export function CanvasFormDialog({
	open,
	username,
	graphSlug,
	canvas,
	onClose,
}: Props) {
	const update = useUpdateCanvasMutation(username, graphSlug);

	const [title, setTitle] = useState("");
	const [instructions, setInstructions] = useState("");
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		if (!open || !canvas) return;
		setTitle(canvas.title);
		setInstructions(canvas.instructions);
		setError(null);
	}, [open, canvas]);

	async function onSubmit(e: React.FormEvent) {
		e.preventDefault();
		if (!canvas) return;
		setError(null);
		try {
			await update.mutateAsync({
				id: canvas.id,
				data: { title, instructions },
			});
			onClose();
		} catch (err) {
			const message =
				err instanceof ApiError ? err.message : "Failed to save canvas.";
			setError(message);
			toast.error(message);
		}
	}

	return (
		<Dialog open={open} onOpenChange={(o) => !o && onClose()}>
			<DialogContent>
				<form onSubmit={onSubmit}>
					<DialogHeader>
						<DialogTitle>Edit canvas</DialogTitle>
						<DialogDescription>
							Rename this canvas and describe its purpose — what it's for and
							what a viewer should take from it.
						</DialogDescription>
					</DialogHeader>
					<div className="space-y-4 pt-4">
						<div className="space-y-2">
							<Label htmlFor="canvasTitle">Title</Label>
							<Input
								id="canvasTitle"
								required
								value={title}
								onChange={(e) => setTitle(e.target.value)}
							/>
						</div>
						<div className="space-y-2">
							<Label htmlFor="canvasInstructions">Purpose</Label>
							<Textarea
								id="canvasInstructions"
								rows={4}
								placeholder="e.g. The fraud-ring subgraph we review each week."
								value={instructions}
								onChange={(e) => setInstructions(e.target.value)}
							/>
						</div>
					</div>
					<FormError error={error} className="mt-4" />
					<DialogFooter>
						<Button variant="ghost" onClick={onClose} type="button">
							Cancel
						</Button>
						<Button type="submit" disabled={update.isPending}>
							{update.isPending ? "Saving…" : "Save changes"}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
