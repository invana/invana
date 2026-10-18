import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@invana/ui";
import type { GraphRef } from "@invana-studio/core";
import type { Approval } from "../notifications/types";
import { ApprovalReview } from "./ApprovalReview";

/**
 * *Review* on an approval in the Inbox: `ApprovalReview` in a dialog. A
 * decision closes it, and the approval leaves the Inbox.
 */
export function ApprovalDialog({
	graph,
	approval,
	onClose,
	onOpenRun,
}: {
	graph: GraphRef;
	/** The approval under review; null closes the dialog. */
	approval: Approval | null;
	onClose: () => void;
	onOpenRun?: (id: string) => void;
}) {
	return (
		<Dialog open={!!approval} onOpenChange={(open) => !open && onClose()}>
			<DialogContent>
				{approval && (
					<>
						<DialogHeader>
							<DialogTitle>{approval.title}</DialogTitle>
							<DialogDescription>
								Nothing is sent until it is approved. At the deadline it expires
								unsent.
							</DialogDescription>
						</DialogHeader>
						<div className="max-h-[32rem] overflow-auto">
							<ApprovalReview
								key={approval.id}
								graph={graph}
								approval={approval}
								onDecided={onClose}
								onOpenRun={onOpenRun}
							/>
						</div>
					</>
				)}
			</DialogContent>
		</Dialog>
	);
}
