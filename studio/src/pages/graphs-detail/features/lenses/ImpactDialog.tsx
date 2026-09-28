/**
 * What a guardrail save would cost — **read before the write**
 * ([GR2](../../../../../docs/for-developers/modules/govern/features/guardrails.md)).
 *
 * *As someone about to tighten what every run in this Graph may do, I want to
 * see which worlds stop fitting and what each one loses, so that I take
 * responsibility for the effect rather than for the sentence.*
 *
 * **The revalidation is the point of the confirm step.** A guardrail that
 * silently invalidates six worlds is a guardrail whose effect nobody saw at the
 * moment they signed for it. The worlds are **narrowed, not deleted** — this
 * dialog says what each one loses, and nothing here removes anything.
 *
 * **The diff list is what changes; the untouched worlds are a sentence under
 * it, by name.** *Nothing changes* and *this world was not checked* must not
 * look alike — the same argument
 * [GR6](../../../../../docs/for-developers/modules/govern/features/guardrails.md)
 * makes for the empty state — but a world that loses nothing is not a diff row
 * either: every glyph a diff list has means *something happened here*, and the
 * kit's neutral row does not exist. Naming them in prose says *checked, and
 * unaffected* without borrowing a mark that means the opposite.
 */

import type { ImpactResponse } from "@/types/govern";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	DiffList,
	DiffRow,
	Spinner,
} from "@invana/ui";

export interface ImpactDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	impact?: ImpactResponse;
	isLoading?: boolean;
	onConfirm: () => void;
	isSaving?: boolean;
}

export function ImpactDialog({
	open,
	onOpenChange,
	impact,
	isLoading,
	onConfirm,
	isSaving,
}: ImpactDialogProps) {
	const changed = impact?.worlds.filter((w) => w.changes) ?? [];
	const unchanged = impact?.worlds.filter((w) => !w.changes) ?? [];

	return (
		<AlertDialog open={open} onOpenChange={onOpenChange}>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>
						{isLoading
							? "Working out what this would change…"
							: (impact?.headline ?? "Save this guardrail?")}
					</AlertDialogTitle>
					<AlertDialogDescription>
						Worlds are narrowed, not deleted. Runs already in flight keep the
						lens they froze — nothing is rewritten backwards.
					</AlertDialogDescription>
				</AlertDialogHeader>

				{isLoading ? (
					<div className="flex items-center gap-2 py-2 text-sm text-muted-foreground">
						<Spinner className="size-3" /> revalidating every world
					</div>
				) : (
					<DiffList className="max-h-72 overflow-y-auto">
						{changed.map((world) => (
							<DiffRow key={world.lens_id} op="change" kind="world">
								<span className="flex min-w-0 flex-col">
									<span>{world.name}</span>
									<span className="text-sm text-muted-foreground">
										{world.summary}
									</span>
									{world.loses.map((lost) => (
										<span
											key={lost}
											className="font-mono text-sm text-destructive"
										>
											− {lost}
										</span>
									))}
									{world.cast_denied.map((address) => (
										<span
											key={address}
											className="font-mono text-sm text-destructive"
										>
											− cast {address}
										</span>
									))}
								</span>
							</DiffRow>
						))}
						{impact && !impact.worlds.length ? (
							// A sentence, never an empty list (GR6).
							<p className="px-1 py-2 text-sm text-muted-foreground">
								No worlds have been written yet, so there is nothing for this to
								narrow. Every question runs inside it from now on.
							</p>
						) : null}
					</DiffList>
				)}

				{!isLoading && unchanged.length ? (
					<p className="text-sm text-muted-foreground">
						Checked and unaffected:{" "}
						{unchanged.map((world) => world.name).join(" · ")}. Each is already
						inside every rule this would set.
					</p>
				) : null}

				<AlertDialogFooter>
					<AlertDialogCancel>Do not save</AlertDialogCancel>
					<AlertDialogAction
						disabled={isLoading || isSaving}
						onClick={onConfirm}
					>
						{isSaving ? "Saving…" : "Save the guardrail"}
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}
