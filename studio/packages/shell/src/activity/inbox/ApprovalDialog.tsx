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
import type { GraphRef } from "@invana-studio/core";
import { FormError } from "@invana-studio/ui";
import { useId, useState } from "react";
import { refusalOf } from "../notifications/api";
import { useDecideApproval, useMemberName } from "../notifications/queries";
import type { Approval } from "../notifications/types";
import { payloadSections, timeLeft } from "./inboxView";

/**
 * *Review* on an approval: what will leave Invana, who may decide, and how
 * long is left, with *Approve* and *Decline*.
 *
 * The payload is exactly what will be sent, so it is drawn twice: the parts a
 * person reads first (channel, recipients, subject, the text) as label/value
 * rows, and the whole payload beneath them, so nothing is hidden behind a
 * summary. The deadline reads as time left; once it has passed the approval
 * has expired — it is never approved by waiting — and both acts are off.
 * A refusal is the engine's own words, inline; a decision closes the dialog,
 * and the approval leaves the Inbox.
 */
export function ApprovalDialog({
	graph,
	approval,
	onClose,
}: {
	graph: GraphRef;
	/** The approval under review; null closes the dialog. */
	approval: Approval | null;
	onClose: () => void;
}) {
	return (
		<Dialog open={!!approval} onOpenChange={(open) => !open && onClose()}>
			<DialogContent>
				{approval && (
					<ApprovalReview
						key={approval.id}
						graph={graph}
						approval={approval}
						onClose={onClose}
					/>
				)}
			</DialogContent>
		</Dialog>
	);
}

function ApprovalReview({
	graph,
	approval,
	onClose,
}: {
	graph: GraphRef;
	approval: Approval;
	onClose: () => void;
}) {
	const [note, setNote] = useState("");
	const decide = useDecideApproval(graph);
	const nameOf = useMemberName(graph);
	const noteId = useId();
	const left = timeLeft(approval.deadline_at);
	const sections = payloadSections(approval.payload);
	const act = (decision: "approve" | "decline") =>
		decide.mutate(
			{ id: approval.id, decision, note: note.trim() },
			{ onSuccess: onClose },
		);

	return (
		<>
			<DialogHeader>
				<DialogTitle>{approval.title}</DialogTitle>
				<DialogDescription>
					Nothing is sent until it is approved. At the deadline it expires
					unsent.
				</DialogDescription>
			</DialogHeader>

			<div className="flex max-h-96 flex-col gap-3 overflow-auto">
				<Eyebrow>What will be sent</Eyebrow>
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
				<TypographyPre className="max-h-48 overflow-auto">
					{JSON.stringify(approval.payload, null, 2)}
				</TypographyPre>

				<PropertyList labelWidth="auto">
					<PropertyRow label="Approvers">
						{approval.approver_ids.length
							? approval.approver_ids.map(nameOf).join(", ")
							: "No one named"}
					</PropertyRow>
					{approval.requested_by_id && (
						<PropertyRow label="Asked by">
							{nameOf(approval.requested_by_id)}
						</PropertyRow>
					)}
					<PropertyRow label="Deadline">
						{left ? `expires in ${left}` : "expired"}
					</PropertyRow>
				</PropertyList>

				<div className="flex flex-col gap-1">
					<Label htmlFor={noteId}>Note (optional)</Label>
					<Textarea
						id={noteId}
						value={note}
						onChange={(e) => setNote(e.target.value)}
						placeholder="Why you approve or decline"
					/>
				</div>
				<FormError error={decide.error ? refusalOf(decide.error) : null} />
			</div>

			<DialogFooter>
				<Button
					variant="outline"
					disabled={!left || decide.isPending}
					onClick={() => act("decline")}
				>
					Decline
				</Button>
				<Button
					disabled={!left || decide.isPending}
					onClick={() => act("approve")}
				>
					Approve
				</Button>
			</DialogFooter>
		</>
	);
}
