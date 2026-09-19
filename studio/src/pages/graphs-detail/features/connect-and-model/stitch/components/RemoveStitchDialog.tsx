/**
 * Removing a stitch — what the union stops spanning (the *Removing* artboard, T8).
 *
 * The dialog states three things, in this order, because that is the order a
 * person needs them:
 *
 * 1. **What it is** — the pair and the rule it carries, so nobody withdraws the
 *    wrong one.
 * 2. **What stops** — a question that crossed this pair will no longer resolve,
 *    and will *say so* rather than answering from one side. That is the loss.
 * 3. **What stays** — both node types, both models, every record. An anchor
 *    links; nothing was merged, so nothing is lost by unlinking (ST2), and a
 *    destructive-looking confirm that is in fact reversible should say so.
 *
 * It is not a `ConfirmDialog`: the header carries the stitch's kind as a badge
 * and the body has a structured *What stays* block, neither of which a generic
 * confirm can hold.
 */

import {
	stitchPair,
	stitchRule,
} from "@/pages/graphs-detail/features/connect-and-model/stitch/allModels";
import type { ModelLink } from "@/types/models";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	Badge,
} from "@invana/ui";
import { Trash2 } from "lucide-react";

interface Props {
	/** The stitch being withdrawn; `null` closes the dialog. */
	link: ModelLink | null;
	/** The model whose records ship its rows, when one does — named, not an id. */
	sourceModel?: string;
	onConfirm: (link: ModelLink) => void;
	onOpenChange: (open: boolean) => void;
}

export function RemoveStitchDialog({
	link,
	sourceModel,
	onConfirm,
	onOpenChange,
}: Props) {
	return (
		<AlertDialog open={link !== null} onOpenChange={onOpenChange}>
			<AlertDialogContent className="max-w-[392px]">
				{link ? (
					<>
						<AlertDialogHeader>
							<div className="flex items-center gap-2">
								<AlertDialogTitle className="text-sm">
									Remove this stitch?
								</AlertDialogTitle>
								<span className="flex-1" />
								<Badge variant="outline" size="xs">
									{link.kind === "anchor" ? "anchor" : "relationship"}
								</Badge>
							</div>
						</AlertDialogHeader>

						<div className="flex flex-col gap-2 text-meta">
							<div className="font-mono text-foreground">
								{stitchPair(link)}
							</div>
							<div className="font-mono text-muted-foreground">
								{link.source_property && link.target_property
									? `on ${stitchRule(link, sourceModel)}`
									: stitchRule(link, sourceModel)}
							</div>
							<p className="text-muted-foreground">
								The union stops spanning that pair. A question that crossed from
								a <span className="font-mono">{link.source_type}</span> to the{" "}
								<span className="font-mono">{link.target_type}</span> it names
								will no longer resolve, and will say so rather than answering
								from one side.
							</p>
							<div className="flex flex-col gap-1 border bg-background p-2">
								<div className="font-semibold text-[10.5px] text-muted-foreground uppercase tracking-wide">
									What stays
								</div>
								<p className="text-muted-foreground">
									Both node types. Both models. Every record on either side.{" "}
									{link.kind === "anchor"
										? "An anchor links — nothing was merged, so nothing is lost by unlinking."
										: "The edge type was declared between the two, not folded into either — so nothing on either side changes."}
								</p>
							</div>
							<p className="text-muted-foreground">
								Removing is immediate. It is not staged, because there is
								nothing to preview about a fact you are withdrawing.
							</p>
						</div>

						<AlertDialogFooter>
							<AlertDialogCancel>Cancel</AlertDialogCancel>
							<AlertDialogAction
								className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
								onClick={() => onConfirm(link)}
							>
								<Trash2 />
								Remove the stitch
							</AlertDialogAction>
						</AlertDialogFooter>
					</>
				) : null}
			</AlertDialogContent>
		</AlertDialog>
	);
}
