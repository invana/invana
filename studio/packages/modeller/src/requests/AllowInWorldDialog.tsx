/**
 * *Allow in a world* — resolve a guardrail request by naming the world the
 * guardrail stops binding in. The engine edits the guardrail's `allowed_in`
 * and marks the request done; a refusal (its guardrail is gone, the world was
 * deleted, someone resolved it first) is the server's sentence, shown here.
 *
 * Opened from the Requests page and from the request bar on a guardrail.
 */

import {
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
import { ApiError, useLensesQuery } from "@invana-studio/core";
import { FormError } from "@invana-studio/ui";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useResolveRequestMutation } from "./queries";
import type { ModelRequest } from "./types";

export interface AllowInWorldDialogProps {
	username: string;
	graphSlug: string;
	/** The request to resolve; null keeps the dialog closed. */
	request: ModelRequest | null;
	onClose: () => void;
}

export function AllowInWorldDialog({
	username,
	graphSlug,
	request,
	onClose,
}: AllowInWorldDialogProps) {
	const worlds = useLensesQuery(username, graphSlug, { kind: "world" });
	const resolve = useResolveRequestMutation(username, graphSlug);
	const [worldId, setWorldId] = useState("");
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		if (request) {
			setWorldId("");
			setError(null);
		}
	}, [request]);

	const onSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!request || !worldId) return;
		setError(null);
		try {
			const done = await resolve.mutateAsync({
				id: request.id,
				data: { action: "allow", world_id: worldId },
			});
			toast.success(done.resolution_note ?? "Allowed");
			onClose();
		} catch (err) {
			setError(
				err instanceof ApiError ? err.message : "The allow was refused.",
			);
		}
	};

	return (
		<Dialog open={request !== null} onOpenChange={(o) => !o && onClose()}>
			<DialogContent>
				<form onSubmit={onSubmit}>
					<DialogHeader>
						<DialogTitle>Allow in a world</DialogTitle>
						<DialogDescription>
							{request?.blocked_by
								? `${request.blocked_by} stops binding for runs asked in the world you pick.`
								: "The guardrail stops binding for runs asked in the world you pick."}
						</DialogDescription>
					</DialogHeader>
					<div className="space-y-2 pt-4">
						<Label htmlFor="allowWorld">World</Label>
						<Select value={worldId} onValueChange={setWorldId}>
							<SelectTrigger id="allowWorld">
								<SelectValue placeholder="Pick a world" />
							</SelectTrigger>
							<SelectContent>
								{(worlds.data?.items ?? []).map((w) => (
									<SelectItem key={w.id} value={w.id}>
										{w.display_name}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
					<FormError error={error} className="mt-4" />
					<DialogFooter>
						<Button variant="ghost" type="button" onClick={onClose}>
							Cancel
						</Button>
						<Button type="submit" disabled={!worldId || resolve.isPending}>
							Allow
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
