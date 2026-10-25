import {
	Badge,
	Button,
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@invana/ui";
import type { GraphRef } from "@invana-studio/core";
import { Bell } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { runPagePath } from "../../activity/activityPath";
import { type InboxItem, runTitle } from "../../activity/inbox/inbox";
import {
	NotificationTray,
	type TrayView,
} from "../../activity/inbox/NotificationTray";
import { useInbox } from "../../activity/inbox/useInbox";
import { useOpenGraph } from "../../products";

/**
 * The header's Notifications: a bell with the number of things that need the
 * person — unread notifications, approvals waiting on them and runs waiting
 * on their answer — that opens the tray over the current page. It never
 * navigates; the tray's *Open inbox* goes on to Activity › Inbox. Every
 * product's header draws it, so what needs someone is one click from any
 * screen inside a Graph. Off a Graph there is no Activity, so there is no bell.
 *
 * Something new that needs the person while Studio is open — an approval, a
 * run waiting on an answer — also raises a toast; *Review* opens it in the
 * tray, *Answer* goes to the run. Updates never toast.
 */
export function ActivityBell() {
	const graph = useOpenGraph();
	const navigate = useNavigate();
	const { items, count, isLoading } = useInbox(graph);
	const [open, setOpen] = useState(false);
	const [view, setView] = useState<TrayView>({ kind: "list" });
	useNeedsToast(graph, items, isLoading, (item) => {
		if (item.kind === "approval") {
			setView({ kind: "review", approval: item.approval });
			setOpen(true);
		} else if (item.kind === "waiting" && graph) {
			navigate(runPagePath(graph, item.run.id));
		}
	});
	if (!graph) return null;
	return (
		<Popover
			open={open}
			onOpenChange={(next) => {
				setOpen(next);
				if (!next) setView({ kind: "list" });
			}}
		>
			<PopoverTrigger asChild>
				<Button variant="ghost" size="sm" aria-label="Notifications">
					<Bell />
					Notifications
					{count > 0 && <Badge>{count}</Badge>}
				</Button>
			</PopoverTrigger>
			<PopoverContent align="end" className="w-[32rem] p-0">
				<NotificationTray
					graph={graph}
					view={view}
					onView={setView}
					onClose={() => {
						setOpen(false);
						setView({ kind: "list" });
					}}
				/>
			</PopoverContent>
		</Popover>
	);
}

/**
 * Toasts each approval or waiting run that appears after the first read of
 * this Graph's Inbox; what was already there when the page opened is not
 * news, so it waits in the tray.
 */
function useNeedsToast(
	graph: GraphRef | undefined,
	items: readonly InboxItem[],
	isLoading: boolean,
	onOpen: (item: InboxItem) => void,
) {
	const seen = useRef<{ graph: string; ids: Set<string> } | null>(null);
	const onOpenRef = useRef(onOpen);
	onOpenRef.current = onOpen;
	const needs = items.filter((i) => i.kind !== "notification");
	const key = needs.map((i) => i.id).join(" ");
	const graphKey = graph ? `${graph.username}/${graph.graphSlug}` : "";

	// biome-ignore lint/correctness/useExhaustiveDependencies: `key` stands for `needs`, rebuilt every render
	useEffect(() => {
		if (!graphKey || isLoading) return;
		if (seen.current?.graph !== graphKey) {
			seen.current = { graph: graphKey, ids: new Set(needs.map((i) => i.id)) };
			return;
		}
		for (const item of needs) {
			if (seen.current.ids.has(item.id)) continue;
			seen.current.ids.add(item.id);
			const [title, label] =
				item.kind === "approval"
					? [`${item.approval.title} waits on you`, "Review"]
					: item.kind === "waiting"
						? [`${runTitle(item.run)} waits on your answer`, "Answer"]
						: [null, null];
			if (!title || !label) continue;
			toast(title, {
				action: { label, onClick: () => onOpenRef.current(item) },
			});
		}
	}, [graphKey, isLoading, key]);
}
