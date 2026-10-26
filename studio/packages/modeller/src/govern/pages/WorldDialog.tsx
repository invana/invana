/**
 * The world's editor as a modal — *New world*, and *Edit* on a world.
 *
 * It wraps the one lens editor (`LensEditor`, `kind="world"`), so authoring
 * stays picking over what the Graph declares and the save is checked against
 * the guardrails while the form is open. Editing an existing world also draws
 * its acts above the form — rename, duplicate, delete — each refused in the
 * server's words when something holds it.
 *
 * A save the server refuses comes back as the same refusals the dry run
 * returns, and lands on the rule that caused it.
 */

import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@invana/ui";
import type { Lens, LensCreate, Refusal } from "@invana-studio/core";
import { ApiError } from "@invana-studio/core";
import { useState } from "react";
import { toast } from "sonner";
import { LensActions } from "../LensActions";
import { LensEditor } from "../LensEditor";
import { useCreateLensMutation, useUpdateLensMutation } from "../queries";

export interface WorldDialogProps {
	username: string;
	graphSlug: string;
	open: boolean;
	/** The world edited; null authors a new one. */
	lens: Lens | null;
	onClose: () => void;
	/** The world a save made or kept — the page opens on it. */
	onSaved: (id: string) => void;
	/** The world was deleted. */
	onGone?: () => void;
}

export function WorldDialog({
	username,
	graphSlug,
	open,
	lens,
	onClose,
	onSaved,
	onGone,
}: WorldDialogProps) {
	const create = useCreateLensMutation(username, graphSlug);
	const update = useUpdateLensMutation(username, graphSlug);
	const [refusals, setRefusals] = useState<Refusal[] | undefined>();

	const close = () => {
		setRefusals(undefined);
		onClose();
	};

	const save = (payload: LensCreate) => {
		setRefusals(undefined);
		const write = lens
			? update.mutateAsync({
					id: lens.id,
					data: {
						name: payload.name,
						rules: payload.rules,
						cast: payload.cast,
						closed_layers: payload.closed_layers,
						as_of: payload.as_of,
					},
				})
			: create.mutateAsync(payload);
		write
			.then((saved) => {
				toast.success(lens ? "World saved" : "World created");
				close();
				onSaved(saved.id);
			})
			.catch((err: unknown) => {
				const detail =
					err instanceof ApiError
						? (err.detail as { refusals?: Refusal[] } | undefined)
						: undefined;
				if (detail?.refusals?.length) setRefusals(detail.refusals);
				else
					toast.error(
						err instanceof Error ? err.message : "The save was refused",
					);
			});
	};

	return (
		<Dialog open={open} onOpenChange={(o) => !o && close()}>
			<DialogContent className="flex max-h-[85vh] flex-col gap-4 overflow-y-auto sm:max-w-2xl">
				<DialogHeader>
					<DialogTitle>
						{lens ? `Edit ${lens.display_name}` : "New world"}
					</DialogTitle>
					<DialogDescription>
						A world narrows what a question sees, inside the guardrails. Every
						choice is picked from what this Graph declares.
					</DialogDescription>
				</DialogHeader>
				{lens ? (
					<LensActions
						username={username}
						graphSlug={graphSlug}
						lens={lens}
						onGone={() => {
							close();
							onGone?.();
						}}
						onOpen={(id) => {
							close();
							onSaved(id);
						}}
					/>
				) : null}
				{/* Keyed on the world, so a second world opens on its own rules. */}
				<LensEditor
					key={lens?.id ?? "new"}
					username={username}
					graphSlug={graphSlug}
					kind="world"
					lens={lens}
					isSaving={create.isPending || update.isPending}
					saveRefusals={refusals}
					onSave={save}
					onCancel={close}
				/>
			</DialogContent>
		</Dialog>
	);
}
