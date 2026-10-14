import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@invana/forms";
import {
	Button,
	Card,
	EmptyState,
	ItemGroup,
	SectionHeader,
	Skeleton,
	ToggleGroup,
	ToggleGroupItem,
} from "@invana/ui";
import type { GraphRef, ProductId } from "@invana-studio/core";
import { Inbox } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useProducts } from "../../products";
import { activityPath } from "../activityPath";
import { useMarkRead } from "../notifications/queries";
import type { Approval } from "../notifications/types";
import { ApprovalDialog } from "./ApprovalDialog";
import { type InboxActs, InboxRow } from "./InboxRow";
import { filterInbox, productsIn } from "./inboxView";
import { useInbox } from "./useInbox";

const ALL = "all";

/**
 * Activity › Inbox — what needs a person on this Graph, each row with its one
 * next step.
 *
 * Three kinds of row, in order: approvals waiting on the reader (*Review*
 * opens `ApprovalDialog`), runs waiting on their answer (*Answer* opens the
 * run), then notifications from rules and schedules, newest first, a dot on
 * the unread ones. The card's count is the bell's — unread notifications,
 * approvals and waiting runs — so the header, the tab label and the bell
 * never disagree.
 *
 * Above the card: a product select offering only the products present,
 * *All* · *Unread* (Unread drops read notifications; an approval or waiting
 * run always stays), and *Mark all read*. With nothing at all the Inbox says
 * so as good news and offers *New rule*, since failures and slow-downs reach
 * it only through a rule; with filters hiding every row it names the filter.
 */
export function InboxTab({ graph }: { graph: GraphRef }) {
	const navigate = useNavigate();
	const products = useProducts();
	const { items, count, unread, isLoading, isError, refetch } = useInbox(graph);
	const markRead = useMarkRead(graph);
	const [product, setProduct] = useState<ProductId | null>(null);
	const [unreadOnly, setUnreadOnly] = useState(false);
	const [reviewing, setReviewing] = useState<Approval | null>(null);

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
				description="Approvals, waiting runs or notifications did not load."
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
				description="Approvals and runs waiting on your answer land here. Failures and slow-downs reach the Inbox through a rule — add one to hear about them."
				actions={
					<Button
						size="sm"
						onClick={() => navigate(`${activityPath(graph, "rules")}?new=1`)}
					>
						New rule
					</Button>
				}
			/>
		);
	}

	const present = productsIn(items);
	const chosen = product && present.includes(product) ? product : null;
	const nameOf = (id: ProductId) =>
		products.find((p) => p.id === id)?.name ?? id;
	const shown = filterInbox(items, { product: chosen, unreadOnly });
	const pending = items.flatMap((i) =>
		i.kind === "approval" ? [i.approval] : [],
	);
	const acts: InboxActs = {
		review: setReviewing,
		openRun: (id) => navigate(activityPath(graph, "runs", id)),
		openSchedule: (id) => navigate(activityPath(graph, "schedules", id)),
		markRead: (ids) => markRead.mutate(ids),
	};
	const hidden = [
		unreadOnly ? "unread" : null,
		chosen ? `from ${nameOf(chosen)}` : null,
	].filter(Boolean);

	return (
		<div className="flex h-full flex-col gap-3 overflow-auto p-4">
			<div className="flex items-center gap-2">
				<Select
					value={chosen ?? ALL}
					onValueChange={(v) => setProduct(v === ALL ? null : (v as ProductId))}
				>
					<SelectTrigger triggerSize="sm" className="w-40" aria-label="Product">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value={ALL}>All products</SelectItem>
						{present.map((id) => (
							<SelectItem key={id} value={id}>
								{nameOf(id)}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
				<ToggleGroup
					type="single"
					size="sm"
					variant="outline"
					value={unreadOnly ? "unread" : "all"}
					onValueChange={(v) => v && setUnreadOnly(v === "unread")}
					aria-label="Show"
				>
					<ToggleGroupItem value="all">All</ToggleGroupItem>
					<ToggleGroupItem value="unread">Unread</ToggleGroupItem>
				</ToggleGroup>
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

			<Card className="overflow-hidden">
				<SectionHeader
					title="Inbox"
					count={
						count
							? `${count} need${count === 1 ? "s" : ""} you`
							: "Nothing needs you"
					}
					className="px-4"
				/>
				{shown.length ? (
					<ItemGroup className="p-2">
						{shown.map((item) => (
							<InboxRow
								key={item.id}
								item={item}
								pending={pending}
								acts={acts}
							/>
						))}
					</ItemGroup>
				) : (
					<EmptyState
						icon={<Inbox className="size-6" />}
						title={`Nothing ${hidden.join(" ")}`}
						description="Other rows are hidden by the filters above."
					/>
				)}
			</Card>

			<ApprovalDialog
				graph={graph}
				approval={reviewing}
				onClose={() => setReviewing(null)}
			/>
		</div>
	);
}
