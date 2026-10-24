/**
 * What pausing or retiring would do to an agent's open work — **item by item,
 * never a count alone** (lifecycle.md).
 *
 * > **As** someone whose agent is behaving badly, **I want** to see what
 * > stopping it disturbs, **so that** I find out before the click rather than
 * > from the Todo that went quiet.
 *
 * One dialog for both acts: the work is the same list either way and only
 * what happens to each piece differs — a Todo in review is untouched by a
 * pause and blocked by a retire. Resume opens nothing: it takes nothing away.
 *
 * Retire also takes a *Why*, at most 500 characters, handed to `onConfirm` and
 * written on the retire event so History shows it. A pause takes none.
 */

import { Field, FieldDescription, FieldLabel, Textarea } from "@invana/forms";
import {
	Button,
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	Skeleton,
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@invana/ui";
import { useState } from "react";
import type { Agent, LifecycleAct, LifecycleItem } from "./types";

const KIND: Record<LifecycleItem["kind"], string> = {
	run: "Run",
	task: "Todo",
	session: "Thread",
};

interface LifecycleDialogProps {
	agent: Agent | null;
	act: LifecycleAct | null;
	items: LifecycleItem[] | undefined;
	isLoading: boolean;
	onCancel: () => void;
	/** The act confirmed; a retire passes its *Why*, a pause an empty one. */
	onConfirm: (why: string) => void;
}

/** What `RetireRequest.why` holds at most. */
const WHY_MAX = 500;

export function LifecycleDialog({
	agent,
	act,
	items,
	isLoading,
	onCancel,
	onConfirm,
}: LifecycleDialogProps) {
	const isRetire = act === "retire";
	const verb = isRetire ? "Retire" : "Pause";
	const isOpen = agent !== null && act !== null;
	const [why, setWhy] = useState("");
	// A dialog opened again starts with no reason, never the last one typed.
	const [wasOpen, setWasOpen] = useState(isOpen);
	if (wasOpen !== isOpen) {
		setWasOpen(isOpen);
		if (isOpen) setWhy("");
	}

	return (
		<Dialog open={isOpen} onOpenChange={(open) => !open && onCancel()}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>
						{verb} {agent?.name}
					</DialogTitle>
					<DialogDescription>
						{isRetire
							? "A retired agent takes no new work and keeps its history. Its open work is listed — nothing is dropped silently."
							: "A paused agent takes nothing new. What is in flight finishes, and resuming releases what this stops."}
					</DialogDescription>
				</DialogHeader>
				{isLoading ? (
					<Skeleton className="h-16 w-full" />
				) : items?.length ? (
					// The list stays whole and scrolls: the count is what it must not become.
					<div className="max-h-[40vh] overflow-y-auto">
						<Table bordered={false} density="compact">
							<TableHeader>
								<TableRow>
									<TableHead>Open work</TableHead>
									<TableHead>What happens</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{items.map((item) => (
									<TableRow key={`${item.kind}:${item.id}`}>
										<TableCell className="max-w-0 truncate">
											{KIND[item.kind]} · {item.title}
										</TableCell>
										<TableCell
											className={
												item.effect === "blocked" || item.effect === "refused"
													? "text-destructive"
													: undefined
											}
										>
											{item.note}
										</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					</div>
				) : (
					<p className="text-muted-foreground">
						Nothing open — there is nothing to disturb.
					</p>
				)}
				{isRetire ? (
					<Field>
						<FieldLabel htmlFor="retire-why">Why</FieldLabel>
						<Textarea
							id="retire-why"
							rows={2}
							maxLength={WHY_MAX}
							value={why}
							onChange={(e) => setWhy(e.target.value)}
							placeholder="Replaced by another agent, no longer needed…"
						/>
						<FieldDescription>
							Shown in its History · {why.length} of {WHY_MAX}
						</FieldDescription>
					</Field>
				) : null}
				<DialogFooter>
					<Button variant="ghost" onClick={onCancel}>
						Cancel
					</Button>
					<Button
						variant="outline"
						disabled={isLoading}
						onClick={() => onConfirm(isRetire ? why.trim() : "")}
					>
						{verb}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
