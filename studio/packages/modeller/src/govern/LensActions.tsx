/**
 * the ladder — **one rung, one edit**.
 *
 * *As someone whose narrowing turned out to be right, I want naming it, sharing
 * it and making it a standard to be three small acts rather than three
 * re-authorings, so that a keeper becomes a bound without anybody rewriting it.*
 *
 * ```
 * unnamed lens --name it--> world --promote--> guardrail
 * ```
 *
 * ([spec.md](../../../../../docs/for-developers/modules/govern/spec.md)). Each arrow
 * is a single field change on one row, which is the whole reason a guardrail
 * and a world are one record: promotion is not a migration, and demotion is the
 * same edit backwards.
 *
 * **Every refusal here names what is holding it.** Deleting a world a schedule
 * fires into or an agent carries is refused naming them
 * ([worlds.md](../../../../../docs/for-developers/modules/govern/features/worlds.md))
 * — a cron with no lens is a run with no circumstances, and *not permitted*
 * with nothing named is not something anybody can act on.
 */

import { Input } from "@invana/forms";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	Button,
	CannotAnswerCard,
	Eyebrow,
} from "@invana/ui";
import type { Lens } from "@invana-studio/core";
import { ApiError } from "@invana-studio/core";
import { ActButton } from "@invana-studio/shell";
import { useState } from "react";
import { toast } from "sonner";
import {
	useDeleteLensMutation,
	useDuplicateLensMutation,
	usePromoteLensMutation,
	useUpdateLensMutation,
} from "./queries";

export interface LensActionsProps {
	username?: string;
	graphSlug?: string;
	lens: Lens;
	onEdit: () => void;
	/** Where to go once this row stops being the thing on screen. */
	onGone: () => void;
	/** Open the copy the duplicate made, which is a new unnamed lens. */
	onOpen: (id: string) => void;
}

export function LensActions({
	username,
	graphSlug,
	lens,
	onEdit,
	onGone,
	onOpen,
}: LensActionsProps) {
	const [naming, setNaming] = useState(false);
	const [name, setName] = useState(lens.name ?? "");
	const [confirmDelete, setConfirmDelete] = useState(false);
	const [refusal, setRefusal] = useState<string | null>(null);

	const update = useUpdateLensMutation(username, graphSlug);
	const promote = usePromoteLensMutation(username, graphSlug);
	const duplicate = useDuplicateLensMutation(username, graphSlug);
	const remove = useDeleteLensMutation(username, graphSlug);

	// Every write on this surface can be refused, and the refusal is the
	// server's sentence — it names the schedules, the agents or the permission.
	const refused = (error: unknown) =>
		setRefusal(
			error instanceof ApiError
				? error.message
				: error instanceof Error
					? error.message
					: "The write was refused.",
		);

	return (
		<section className="flex min-w-0 flex-col gap-1">
			<Eyebrow>Editing</Eyebrow>
			<div className="flex min-w-0 flex-col gap-2 pt-1">
				{refusal ? (
					<CannotAnswerCard label="refused">{refusal}</CannotAnswerCard>
				) : null}

				{naming ? (
					<div className="flex min-w-0 flex-col gap-1">
						<div className="flex min-w-0 gap-2">
							<Input
								inputSize="sm"
								autoFocus
								aria-label="Name"
								value={name}
								placeholder="EU · H1 2026"
								onChange={(e) => setName(e.target.value)}
							/>
							<Button
								size="sm"
								disabled={!name.trim() || update.isPending}
								onClick={() =>
									update
										.mutateAsync({ id: lens.id, data: { name: name.trim() } })
										.then(() => {
											setNaming(false);
											setRefusal(null);
											toast.success(
												lens.is_named
													? "Renamed"
													: "Added to this Graph's Worlds",
											);
										})
										.catch(refused)
								}
							>
								{lens.is_named ? "Rename" : "Add to Worlds"}
							</Button>
						</div>
						<p className="text-sm text-muted-foreground">
							{lens.is_named
								? "It is already public, so a rename is a rename — the slug in a link stays what it was."
								: "Naming it is what puts it in this Graph's Worlds list. Until then it belongs to your run and to nobody else."}
						</p>
					</div>
				) : (
					<div className="flex flex-wrap gap-2">
						<ActButton
							area="model"
							variant="outline"
							size="sm"
							onClick={onEdit}
						>
							Edit rules
						</ActButton>
						<ActButton
							area="model"
							variant="outline"
							size="sm"
							onClick={() => {
								setName(lens.name ?? "");
								setNaming(true);
							}}
						>
							{lens.is_named ? "Rename" : "Name it"}
						</ActButton>
						<ActButton
							area="model"
							variant="outline"
							size="sm"
							disabled={duplicate.isPending}
							onClick={() =>
								duplicate
									.mutateAsync(lens.id)
									.then((copy) => {
										setRefusal(null);
										// A duplicate is unnamed and private — the ladder's
										// bottom rung, so somebody can try a change without
										// touching what everyone else is picking.
										toast.success("Duplicated — unnamed, and private to you");
										onOpen(copy.id);
									})
									.catch(refused)
							}
						>
							Duplicate
						</ActButton>
						{lens.kind === "world" ? (
							<ActButton
								area="model"
								variant="outline"
								size="sm"
								disabled={promote.isPending}
								onClick={() =>
									promote
										.mutateAsync({ id: lens.id, scope: "graph" })
										.then(() => {
											setRefusal(null);
											toast.success(
												"Promoted — it leaves Worlds and is now in force on every run",
											);
											onGone();
										})
										.catch(refused)
								}
							>
								Promote to guardrail
							</ActButton>
						) : null}
						<ActButton
							area="model"
							variant="ghost"
							size="sm"
							className="text-destructive"
							onClick={() => setConfirmDelete(true)}
						>
							Delete
						</ActButton>
					</div>
				)}
			</div>

			<AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Delete {lens.display_name}?</AlertDialogTitle>
						<AlertDialogDescription>
							{lens.usage?.runs
								? `It has grounded ${lens.usage.runs} run${lens.usage.runs > 1 ? "s" : ""}. Those runs keep the lens they froze — a past answer stays reconstructible whatever happens to this row.`
								: "Nothing has run under it yet."}{" "}
							A world a schedule fires into or an agent carries cannot be
							deleted, and the refusal names them.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Keep it</AlertDialogCancel>
						<AlertDialogAction
							onClick={() =>
								remove
									.mutateAsync(lens.id)
									.then(() => {
										setConfirmDelete(false);
										toast.success("Deleted");
										onGone();
									})
									.catch((error) => {
										setConfirmDelete(false);
										refused(error);
									})
							}
						>
							Delete
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</section>
	);
}
