import {
	Button,
	EmptyState,
	ItemGroup,
	SectionHeader,
	Separator,
	Skeleton,
} from "@invana/ui";
import type { GraphRef } from "@invana-studio/core";
import { ArrowLeft, Inbox } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { activityPath, runPagePath } from "../activityPath";
import { useMarkRead } from "../notifications/queries";
import type { Approval } from "../notifications/types";
import { ApprovalReview } from "./ApprovalReview";
import { type InboxActs, InboxRow } from "./InboxRow";
import { useInbox } from "./useInbox";

/** What the tray shows: the list, or one approval under review inside it. */
export type TrayView =
	| { kind: "list" }
	| { kind: "review"; approval: Approval };

/** Updates past this many wait in the Inbox. */
const UPDATES_SHOWN = 8;

/**
 * The bell's tray — what needs the person, decided without leaving the page.
 *
 * | Section | Rows | Next step |
 * |---|---|---|
 * | Needs you | approvals waiting on me, then runs waiting on my answer | *Review* opens the approval here · *Answer* goes to the run |
 * | Updates | my notifications, newest first, unread with a dot | goes to its target, marked read |
 *
 * It reads what the Inbox reads (`useInbox`), so the bell, the tray and the
 * Inbox carry one count. *Approve* · *Decline* exist only inside *Review*,
 * after the payload, so nothing is approved from a row. Anything that leaves
 * the page — a run, a schedule, the Inbox, a new rule — closes the tray.
 */
export function NotificationTray({
	graph,
	view,
	onView,
	onClose,
}: {
	graph: GraphRef;
	view: TrayView;
	onView: (view: TrayView) => void;
	onClose: () => void;
}) {
	const navigate = useNavigate();
	const go = (to: string) => {
		onClose();
		navigate(to);
	};
	const openRun = (id: string) => go(runPagePath(graph, id));

	if (view.kind === "review") {
		return (
			<div className="flex max-h-[75vh] flex-col">
				<div className="flex items-center gap-2 border-b p-2">
					<Button
						variant="ghost"
						size="icon"
						aria-label="Back to notifications"
						onClick={() => onView({ kind: "list" })}
					>
						<ArrowLeft />
					</Button>
					<span className="truncate font-medium">{view.approval.title}</span>
				</div>
				<div className="overflow-auto p-3">
					<ApprovalReview
						key={view.approval.id}
						graph={graph}
						approval={view.approval}
						onDecided={() => onView({ kind: "list" })}
						onOpenRun={openRun}
					/>
				</div>
			</div>
		);
	}

	return (
		<TrayList
			graph={graph}
			acts={{
				review: (approval) => onView({ kind: "review", approval }),
				openRun,
				openSchedule: (id) => go(activityPath(graph, "schedules", id)),
			}}
			go={go}
		/>
	);
}

function TrayList({
	graph,
	acts,
	go,
}: {
	graph: GraphRef;
	/** Every next step but marking read, which the list owns. */
	acts: Omit<InboxActs, "markRead">;
	go: (to: string) => void;
}) {
	const { items, unread, isLoading, isError, refetch } = useInbox(graph);
	const markRead = useMarkRead(graph);
	const rowActs: InboxActs = {
		...acts,
		markRead: (ids) => markRead.mutate(ids),
	};
	const needs = items.filter((i) => i.kind !== "notification");
	const updates = items.filter((i) => i.kind === "notification");
	const pending = needs.flatMap((i) =>
		i.kind === "approval" ? [i.approval] : [],
	);

	return (
		<div className="flex max-h-[75vh] flex-col">
			<div className="flex items-center gap-2 p-3">
				<span className="font-medium">Notifications</span>
				<span className="text-muted-foreground">
					{[
						needs.length
							? `${needs.length} need${needs.length === 1 ? "s" : ""} you`
							: null,
						unread ? `${unread} unread` : null,
					]
						.filter(Boolean)
						.join(" · ")}
				</span>
				<Button
					variant="ghost"
					size="sm"
					className="ml-auto"
					disabled={unread === 0 || markRead.isPending}
					onClick={() => markRead.mutate(undefined)}
				>
					Mark all read
				</Button>
			</div>
			<Separator />

			<div className="overflow-auto">
				{isLoading ? (
					<div className="flex flex-col gap-2 p-3">
						{["a", "b", "c"].map((k) => (
							<Skeleton key={k} className="h-10 w-full" />
						))}
					</div>
				) : isError ? (
					<EmptyState
						icon={<Inbox className="size-6" />}
						title="Notifications could not be read"
						actions={
							<Button
								variant="outline"
								size="sm"
								onClick={() => void refetch()}
							>
								Try again
							</Button>
						}
					/>
				) : items.length === 0 ? (
					<EmptyState
						icon={<Inbox className="size-6" />}
						title="Nothing needs you"
						description="Approvals and questions from agents land here. Failures and slow-downs need a rule to reach you."
						actions={
							<Button
								variant="outline"
								size="sm"
								onClick={() => go(`${activityPath(graph, "rules")}?new=1`)}
							>
								New rule
							</Button>
						}
					/>
				) : (
					<>
						{needs.length > 0 && (
							<>
								<SectionHeader
									title="Needs you"
									count={String(needs.length)}
									className="px-3"
								/>
								<ItemGroup className="px-2 pb-2">
									{needs.map((item) => (
										<InboxRow
											key={item.id}
											item={item}
											pending={pending}
											acts={rowActs}
										/>
									))}
								</ItemGroup>
							</>
						)}
						{updates.length > 0 && (
							<>
								<SectionHeader
									title="Updates"
									count={unread ? `${unread} unread` : undefined}
									className="px-3"
								/>
								<ItemGroup className="px-2 pb-2">
									{updates.slice(0, UPDATES_SHOWN).map((item) => (
										<InboxRow
											key={item.id}
											item={item}
											pending={pending}
											acts={rowActs}
										/>
									))}
								</ItemGroup>
							</>
						)}
					</>
				)}
			</div>

			<Separator />
			<div className="flex items-center gap-2 p-2">
				<Button
					variant="ghost"
					size="sm"
					onClick={() => go(activityPath(graph, "rules"))}
				>
					Rules
				</Button>
				<Button
					variant="outline"
					size="sm"
					className="ml-auto"
					onClick={() => go(activityPath(graph, "inbox"))}
				>
					Open inbox
				</Button>
			</div>
		</div>
	);
}
