import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@invana/ui";
import { toast } from "sonner";
import { useDeleteModelMutation } from "../../../../hooks/queries/useModels";
import { ApiError } from "../../../../services/api/client";
import type { GraphModelSummary } from "../../../../types/models";

interface Props {
	/** The model pending deletion, or null when the dialog is closed. */
	model: GraphModelSummary | null;
	username: string;
	graphSlug: string;
	/** Clear the pending model (close the dialog). */
	onClose: () => void;
	/** Runs after a successful delete — e.g. navigate away from the open model. */
	onDeleted?: () => void;
}

/**
 * Confirm-and-delete dialog for a whole graph model. Owns the delete mutation so
 * both the model list (per-row menu) and the model detail header share one
 * implementation; callers only supply the pending model and any post-delete nav.
 */
export function DeleteModelDialog({
	model,
	username,
	graphSlug,
	onClose,
	onDeleted,
}: Props) {
	const del = useDeleteModelMutation(username, graphSlug);

	async function onConfirm() {
		if (!model) return;
		try {
			await del.mutateAsync(model.id);
			onDeleted?.();
		} catch (err) {
			toast.error(err instanceof ApiError ? err.message : "Failed to delete.");
		} finally {
			onClose();
		}
	}

	return (
		<AlertDialog open={model !== null} onOpenChange={(o) => !o && onClose()}>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>Delete model?</AlertDialogTitle>
					<AlertDialogDescription>
						Delete "{model?.name}" and all its versions? This cannot be undone.
					</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter>
					<AlertDialogCancel>Cancel</AlertDialogCancel>
					<AlertDialogAction onClick={onConfirm}>Delete</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}
