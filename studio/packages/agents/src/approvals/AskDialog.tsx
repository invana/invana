/**
 * One ask under review, opened from its row: what it wants, who asked through
 * which agents, who it is routed to and why, exactly what it holds, the time
 * left, and — for a named approver while it is pending — a note with Decline ·
 * Approve. A delegation also offers *Allow always*, which writes the caller's
 * *May delegate to*; every other approval is for this run only.
 *
 * A member who is not named reads it with the acts off and the approvers
 * named. A refusal — decided first by someone else, expired meanwhile — is the
 * engine's own words, inline.
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
	Eyebrow,
	PropertyList,
	PropertyRow,
	TypographyPre,
} from "@invana/ui";
import { formatElapsed } from "@invana-studio/core";
import type { Approval } from "@invana-studio/shell";
import { FormError } from "@invana-studio/ui";
import { useId, useState } from "react";
import { ActorChain } from "../ledger/ledgerParts";
import { answer, KindBadge, RunLink, routedTo } from "./askParts";
import { useDecideMutation } from "./queries";

export function AskDialog({
	username,
	graphSlug,
	ask,
	me,
	onClose,
	onOpenRun,
}: {
	username: string;
	graphSlug: string;
	/** The ask under review; null closes the dialog. */
	ask: Approval | null;
	/** The reader's username, to name them `you`. */
	me: string | undefined;
	onClose: () => void;
	onOpenRun: (id: string) => void;
}) {
	return (
		<Dialog open={!!ask} onOpenChange={(o) => !o && onClose()}>
			<DialogContent className="max-w-2xl">
				{ask && (
					<AskReview
						key={ask.id}
						username={username}
						graphSlug={graphSlug}
						ask={ask}
						me={me}
						onClose={onClose}
						onOpenRun={onOpenRun}
					/>
				)}
			</DialogContent>
		</Dialog>
	);
}

function AskReview({
	username,
	graphSlug,
	ask,
	me,
	onClose,
	onOpenRun,
}: {
	username: string;
	graphSlug: string;
	ask: Approval;
	me: string | undefined;
	onClose: () => void;
	onOpenRun: (id: string) => void;
}) {
	const [note, setNote] = useState("");
	const noteId = useId();
	const decide = useDecideMutation({ username, graphSlug });
	const pending = ask.status === "pending";
	const canDecide = !!ask.can_decide && pending && !decide.isPending;
	const act = (decision: "approve" | "decline", scope?: "run" | "always") =>
		decide.mutate(
			{ id: ask.id, decision, note: note.trim(), scope },
			{ onSuccess: onClose },
		);
	const deadline = new Date(ask.deadline_at);
	const approvers = (ask.approver_names ?? []).join(", ");

	return (
		<>
			<DialogHeader>
				<DialogTitle className="flex items-center gap-2">
					<KindBadge kind={ask.kind ?? ask.subject_kind} />
					{ask.wants || ask.title}
				</DialogTitle>
				<DialogDescription>
					An approved ask is for this run, and reaches the asking agent only. At
					the deadline it expires — never approved by waiting.
				</DialogDescription>
			</DialogHeader>
			<div className="flex max-h-[32rem] flex-col gap-3 overflow-auto">
				<PropertyList labelWidth="auto">
					<PropertyRow label="Asked by">
						<ActorChain chain={ask.asked_by ?? []} />
					</PropertyRow>
					<PropertyRow label="Routed to">
						{routedTo(ask, me) || "—"}
					</PropertyRow>
					<PropertyRow label="Run">
						<RunLink ask={ask} onOpen={onOpenRun} />
					</PropertyRow>
					<PropertyRow label={pending ? "Deadline" : "Answer"}>
						{pending
							? deadline.getTime() > Date.now()
								? `expires in ${formatElapsed(deadline.getTime() - Date.now())}`
								: "expired — nothing was sent"
							: answer(ask)}
					</PropertyRow>
					{!pending && ask.note && (
						<PropertyRow label="Note">{ask.note}</PropertyRow>
					)}
				</PropertyList>
				<Eyebrow>Exactly what it holds</Eyebrow>
				<TypographyPre className="max-h-40 overflow-auto">
					{JSON.stringify(ask.payload, null, 2)}
				</TypographyPre>
				{pending && !ask.can_decide && (
					<p className="text-muted-foreground">
						Only {approvers || "its approvers"} can decide this.
					</p>
				)}
				{canDecide && (
					<div className="flex flex-col gap-1">
						<Label htmlFor={noteId}>Note (optional)</Label>
						<Textarea
							id={noteId}
							value={note}
							onChange={(e) => setNote(e.target.value)}
							placeholder="Why you approve or decline"
						/>
					</div>
				)}
				<FormError error={decide.error} />
			</div>
			{pending && (
				<DialogFooter>
					<Button
						variant="outline"
						disabled={!canDecide}
						onClick={() => act("decline")}
					>
						Decline
					</Button>
					{ask.kind === "delegation" && (
						<Button
							variant="outline"
							disabled={!canDecide}
							onClick={() => act("approve", "always")}
						>
							Allow always
						</Button>
					)}
					<Button disabled={!canDecide} onClick={() => act("approve", "run")}>
						{ask.kind === "delegation" ? "Approve for this run" : "Approve"}
					</Button>
				</DialogFooter>
			)}
		</>
	);
}
