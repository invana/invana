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
import { canvasesApi } from "../../../../services/api/canvases";
import { ApiError } from "../../../../services/api/client";
import type { CanvasSummary } from "../../../../types/canvas";

interface Props {
	open: boolean;
	username: string;
	graphSlug: string;
	/** The canvas being edited — its purpose (instructions) + banner preview. */
	canvas: CanvasSummary | null;
	/**
	 * Current title of the canvas's session. The title names the session and its
	 * 1:1 canvas (RFC-045), so it's owned by the session, not the canvas.
	 */
	sessionTitle: string;
	/** Rename the canvas's session (the shared title). */
	onRenameSession: (id: string, title: string) => Promise<unknown>;
	onClose: () => void;
}

/**
 * Edit a session's canvas: rename the session (the shared title, RFC-045) and
 * describe the canvas's purpose (instructions). Opened from a tab/row header.
 * Creation is handled by "Save current view" in the panel (it needs the live
 * canvas state); this dialog only renames + re-purposes an existing one.
 */
export function CanvasFormDialog({
	open,
	username,
	graphSlug,
	canvas,
	sessionTitle,
	onRenameSession,
	onClose,
}: Props) {
	const update = useUpdateCanvasMutation(username, graphSlug);

	const [title, setTitle] = useState("");
	const [instructions, setInstructions] = useState("");
	const [banner, setBanner] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		if (!open || !canvas) return;
		setTitle(sessionTitle);
		setInstructions(canvas.instructions);
		setError(null);
		// Fetch the full canvas for its banner preview (RFC-045) — the list summary
		// omits the heavy image. Best-effort: no preview if it isn't there yet.
		setBanner(null);
		let cancelled = false;
		if (canvas.hasBanner) {
			canvasesApi
				.get(username, graphSlug, canvas.id)
				.then((c) => !cancelled && setBanner(c.banner ?? null))
				.catch(() => {});
		}
		return () => {
			cancelled = true;
		};
	}, [open, canvas, sessionTitle, username, graphSlug]);

	async function onSubmit(e: React.FormEvent) {
		e.preventDefault();
		if (!canvas) return;
		setError(null);
		try {
			// The title renames the session (the shared name); the purpose stays on
			// the canvas. Skip the rename when unchanged so a purpose-only edit
			// doesn't touch the session.
			if (title !== sessionTitle) {
				await onRenameSession(canvas.sessionId, title);
			}
			await update.mutateAsync({ id: canvas.id, data: { instructions } });
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
						<DialogTitle>Edit session</DialogTitle>
						<DialogDescription>
							Rename this session and describe its canvas's purpose — what it's
							for and what a viewer should take from it.
						</DialogDescription>
					</DialogHeader>
					{banner && (
						<div className="mt-4 overflow-hidden rounded-md border border-border bg-muted/30">
							<img
								src={banner}
								alt="Canvas preview"
								className="h-32 w-full object-contain"
							/>
						</div>
					)}
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
