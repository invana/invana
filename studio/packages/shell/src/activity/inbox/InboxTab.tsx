import {
	Badge,
	Button,
	Card,
	EmptyState,
	EmptyStateLock,
	Item,
	ItemActions,
	ItemContent,
	ItemDescription,
	ItemGroup,
	ItemMedia,
	ItemTitle,
	SectionHeader,
	Skeleton,
	StatusIcon,
} from "@invana/ui";
import { formatRelativeTime, type GraphRef } from "@invana-studio/core";
import { Inbox, Lock } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useProducts } from "../../products";
import { activityPath } from "../activityPath";
import { type InboxItem, runTitle } from "./inbox";
import { useInbox } from "./useInbox";

/**
 * Activity › Inbox — what needs a person on this Graph, each row with its
 * next step.
 *
 * Until the engine records notifications it reads the runs journal: a run
 * waiting on someone's answer, and a run that failed in the last week (see
 * `inbox.ts`). A row names the product the run came from and opens the run's
 * page. With nothing to act on it draws the kit's `EmptyState`, which still
 * says what fills the rest of the Inbox once notifications exist.
 */
export function InboxTab({ graph }: { graph: GraphRef }) {
	const { items, isLoading, isError, refetch } = useInbox(graph);

	if (isLoading) {
		return (
			<div className="flex flex-col gap-2 p-4">
				{["a", "b", "c"].map((k) => (
					<Skeleton key={k} className="h-12 w-full" />
				))}
			</div>
		);
	}
	if (isError) {
		return (
			<EmptyState
				className="h-full"
				icon={<Inbox className="size-6" />}
				title="The Inbox could not be read"
				description="The Graph's runs did not load."
				actions={
					<Button variant="outline" size="sm" onClick={() => void refetch()}>
						Try again
					</Button>
				}
			/>
		);
	}
	if (items.length === 0) {
		return (
			<EmptyState
				className="h-full"
				icon={<Inbox className="size-6" />}
				title="Nothing needs you"
				description="A run that fails or stops to wait on someone's answer lands here, with its next step. Requests and slow-downs join them once the engine records notifications."
				locks={[
					<EmptyStateLock key="notifications" icon={<Lock />}>
						Requests and rules open when the engine records notifications
					</EmptyStateLock>,
				]}
			/>
		);
	}

	return (
		<div className="h-full overflow-auto p-4">
			<Card className="overflow-hidden">
				<SectionHeader
					title="Inbox"
					count={`${items.length} need${items.length === 1 ? "s" : ""} you`}
					className="px-4"
				/>
				<ItemGroup className="p-2">
					{items.map((item) => (
						<InboxRow key={item.run.id} item={item} graph={graph} />
					))}
				</ItemGroup>
			</Card>
		</div>
	);
}

function InboxRow({ item, graph }: { item: InboxItem; graph: GraphRef }) {
	const navigate = useNavigate();
	const products = useProducts();
	const productName =
		products.find((p) => p.id === item.product)?.name ?? item.product;
	const waiting = item.reason === "waiting";
	const when = item.at ? formatRelativeTime(new Date(item.at)) : null;
	const what = waiting
		? "waits on your answer"
		: `failed${item.run.step_label ? ` at ${item.run.step_label}` : ""}`;
	const open = () => navigate(activityPath(graph, "runs", item.run.id));

	return (
		<Item variant="muted">
			<ItemMedia>
				<StatusIcon
					state={waiting ? "question" : "error"}
					label={waiting ? "Waiting" : "Failed"}
				/>
			</ItemMedia>
			<ItemContent className="min-w-0">
				<ItemTitle className="truncate">{runTitle(item.run)}</ItemTitle>
				<ItemDescription>
					{[what, when].filter(Boolean).join(" · ")}
				</ItemDescription>
			</ItemContent>
			<ItemActions>
				<Badge variant="outline">{productName}</Badge>
				<Button variant="outline" size="sm" onClick={open}>
					{waiting ? "Answer" : "Open run"}
				</Button>
			</ItemActions>
		</Item>
	);
}
