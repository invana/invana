/**
 * One gated act — publish, restore or a pin move — confirmed with the reason
 * History keeps.
 *
 * The act goes to the engine as it is; if the eval gate refuses it, the
 * refusal is drawn in the dialog with *Run the evals* where the gate asks for
 * a run, and the reader acts again once it has settled. The dialog never
 * predicts the gate: it shows what the engine answered.
 */

import { Label, Textarea } from "@invana/forms";
import {
	Button,
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@invana/ui";
import type { ReactNode } from "react";
import { useState } from "react";
import { EvalGateCard } from "./EvalGateCard";

export function GatedActDialog({
	open,
	title,
	description,
	confirm,
	pending,
	error,
	onConfirm,
	onClose,
	onRunEvals,
	runningEvals,
	initialWhy = "",
	children,
}: {
	open: boolean;
	title: ReactNode;
	description: ReactNode;
	/** The button's words — `Publish v9`, `Restore v7`. */
	confirm: string;
	pending: boolean;
	error: unknown;
	onConfirm: (why: string) => void;
	onClose: () => void;
	onRunEvals?: () => void;
	runningEvals?: boolean;
	/** A reason already typed where the act began. */
	initialWhy?: string;
	children?: ReactNode;
}) {
	const [why, setWhy] = useState(initialWhy);
	// Each opening starts from the reason typed where the act began.
	const [openedWith, setOpenedWith] = useState(open);
	if (open !== openedWith) {
		setOpenedWith(open);
		if (open) setWhy(initialWhy);
	}
	return (
		<Dialog open={open} onOpenChange={(o) => !o && onClose()}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>{title}</DialogTitle>
					<DialogDescription>{description}</DialogDescription>
				</DialogHeader>
				<div className="flex flex-col gap-3">
					{children}
					<div className="flex flex-col gap-1.5">
						<Label htmlFor="gated-why">Why — kept in History</Label>
						<Textarea
							id="gated-why"
							value={why}
							maxLength={500}
							onChange={(e) => setWhy(e.target.value)}
							placeholder="Readers ask which world an answer used"
						/>
					</div>
					<EvalGateCard
						error={error}
						onRunEvals={onRunEvals}
						running={runningEvals}
					/>
				</div>
				<DialogFooter>
					<Button variant="ghost" onClick={onClose}>
						Cancel
					</Button>
					<Button disabled={pending} onClick={() => onConfirm(why.trim())}>
						{pending ? "Working…" : confirm}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
