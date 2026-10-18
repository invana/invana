import { Label, Textarea } from "@invana/forms";
import {
	Button,
	Eyebrow,
	PropertyList,
	PropertyRow,
	TypographyPre,
} from "@invana/ui";
import { type GraphRef, useAuth } from "@invana-studio/core";
import { FormError } from "@invana-studio/ui";
import { useId, useState } from "react";
import { refusalOf } from "../notifications/api";
import { useDecideApproval, useMemberName } from "../notifications/queries";
import type { Approval } from "../notifications/types";
import { effectOf, payloadSections, timeLeft } from "./inboxView";

/**
 * One approval under review: what will leave Invana, what each choice does,
 * who asked and who may decide, how long is left, and *Approve* · *Decline*.
 * The Inbox's dialog and the bell's tray both draw it, so a decision reads
 * the same wherever it is made.
 *
 * The payload is exactly what will be sent, so it is drawn twice: the parts a
 * person reads first (channel, recipients, subject, the text) as label/value
 * rows, and the whole payload beneath them, so nothing is hidden behind a
 * summary. Past the deadline the approval has expired — it is never approved
 * by waiting — and both acts are off; a member not named reads it with both
 * acts off and the approvers named. A refusal (decided first by someone else,
 * expired meanwhile) is the engine's own words, inline. A decision calls
 * `onDecided`, and the approval leaves the Inbox.
 */
export function ApprovalReview({
	graph,
	approval,
	onDecided,
	onOpenRun,
}: {
	graph: GraphRef;
	approval: Approval;
	onDecided: () => void;
	/** Go to the run the approval came from; the row is plain text without it. */
	onOpenRun?: (id: string) => void;
}) {
	const [note, setNote] = useState("");
	const decide = useDecideApproval(graph);
	const nameOf = useMemberName(graph);
	const { user } = useAuth();
	const noteId = useId();
	const left = timeLeft(approval.deadline_at);
	const sections = payloadSections(approval.payload);
	const effect = effectOf(approval.subject_kind);
	const approvers = approval.approver_ids.map(nameOf).join(", ");
	const named = !!user && approval.approver_ids.includes(String(user.id));
	const open = !!left && named && !decide.isPending;
	const act = (decision: "approve" | "decline") =>
		decide.mutate(
			{ id: approval.id, decision, note: note.trim() },
			{ onSuccess: onDecided },
		);

	return (
		<div className="flex flex-col gap-3">
			<div className="flex flex-col gap-3">
				<Eyebrow>Exactly what will be sent</Eyebrow>
				{sections.map((section, i) => (
					<div key={section.heading ?? i} className="flex flex-col gap-1">
						{section.heading && (
							<Eyebrow tone="foreground">{section.heading}</Eyebrow>
						)}
						<PropertyList labelWidth="auto">
							{section.rows.map((row) => (
								<PropertyRow key={row.label} label={row.label}>
									<span className="whitespace-pre-wrap">{row.value}</span>
								</PropertyRow>
							))}
						</PropertyList>
					</div>
				))}
				<Eyebrow>Full payload</Eyebrow>
				<TypographyPre className="max-h-40 overflow-auto">
					{JSON.stringify(approval.payload, null, 2)}
				</TypographyPre>

				<Eyebrow>What each choice does</Eyebrow>
				<PropertyList labelWidth="auto">
					<PropertyRow label="Approve">{effect.approve}</PropertyRow>
					<PropertyRow label="Decline">{effect.decline}</PropertyRow>
				</PropertyList>

				<PropertyList labelWidth="auto">
					{approval.requested_by_id && (
						<PropertyRow label="Asked by">
							{nameOf(approval.requested_by_id)}
						</PropertyRow>
					)}
					{approval.run_id && (
						<PropertyRow label="From run">
							{onOpenRun ? (
								<Button
									variant="link"
									size="sm"
									className="h-auto p-0"
									onClick={() => onOpenRun(approval.run_id as string)}
								>
									Open the run
								</Button>
							) : (
								approval.run_id.slice(0, 8)
							)}
						</PropertyRow>
					)}
					<PropertyRow label="Approvers">
						{approvers || "No one named"}
					</PropertyRow>
					<PropertyRow label="Deadline">
						{left ? `expires in ${left}` : "expired — nothing was sent"}
					</PropertyRow>
				</PropertyList>

				{!named && (
					<p className="text-muted-foreground">
						Only {approvers || "its approvers"} can decide this.
					</p>
				)}
				{named && left && (
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
				<FormError error={decide.error ? refusalOf(decide.error) : null} />
			</div>

			<div className="flex justify-end gap-2">
				<Button
					variant="outline"
					disabled={!open}
					onClick={() => act("decline")}
				>
					Decline
				</Button>
				<Button disabled={!open} onClick={() => act("approve")}>
					Approve
				</Button>
			</div>
		</div>
	);
}
