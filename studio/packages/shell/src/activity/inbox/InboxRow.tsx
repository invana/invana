import {
	Badge,
	Button,
	Item,
	ItemActions,
	ItemContent,
	ItemDescription,
	ItemMedia,
	ItemTitle,
	StatusDot,
	StatusIcon,
} from "@invana/ui";
import { formatRelativeTime, type ProductId } from "@invana-studio/core";
import {
	AlarmClock,
	Bell,
	type LucideIcon,
	Send,
	ShieldCheck,
	TimerOff,
} from "lucide-react";
import type { ReactNode } from "react";
import { useProducts } from "../../products";
import type { Approval, Notification } from "../notifications/types";
import { type InboxItem, runTitle } from "./inbox";
import { type NextStep, nextStepOf, timeLeft } from "./inboxView";

/** What a row's next step asks of the tab. */
export interface InboxActs {
	/** Open the review of an approval. */
	review: (approval: Approval) => void;
	/** Go to a run's page. */
	openRun: (id: string) => void;
	/** Go to a schedule's page. */
	openSchedule: (id: string) => void;
	/** Mark these notifications read. */
	markRead: (ids: string[]) => void;
}

const KIND_ICON: Record<string, LucideIcon> = {
	event: Bell,
	approval: ShieldCheck,
	reminder: AlarmClock,
	expired: TimerOff,
	delivery: Send,
};

/**
 * One Inbox row: an unread dot, what it is, a muted line under it, the
 * product it came from, and exactly one next step.
 *
 * | Row | Mark | Next step |
 * |---|---|---|
 * | approval | shield | *Review* |
 * | waiting run | question | *Answer* — the run's page |
 * | notification | by kind; a failure reads as an error | *Review* · *Open run* · *Open* · *Mark read* |
 *
 * Everything that counts toward the bell — an approval, a waiting run, an
 * unread notification — sits on the muted surface with a dot; a read
 * notification sits plain. Opening a notification marks it read first.
 */
export function InboxRow({
	item,
	pending,
	acts,
}: {
	item: InboxItem;
	/** Approvals still waiting on the reader — what *Review* can open. */
	pending: readonly Approval[];
	acts: InboxActs;
}) {
	if (item.kind === "approval") {
		const left = timeLeft(item.approval.deadline_at);
		return (
			<Row
				dot="Needs you"
				mark={<ShieldCheck className="size-4 text-muted-foreground" />}
				title={`${item.approval.title} waits on you`}
				detail={left ? `deadline in ${left}` : "past its deadline"}
				product={null}
				action={
					<Button
						variant="outline"
						size="sm"
						onClick={() => acts.review(item.approval)}
					>
						Review
					</Button>
				}
			/>
		);
	}
	if (item.kind === "waiting") {
		return (
			<Row
				dot="Needs you"
				mark={<StatusIcon state="question" label="Waiting" />}
				title={runTitle(item.run)}
				detail={["waits on your answer", whenOf(item.at)]
					.filter(Boolean)
					.join(" · ")}
				product={item.product}
				action={
					<Button
						variant="outline"
						size="sm"
						onClick={() => acts.openRun(item.run.id)}
					>
						Answer
					</Button>
				}
			/>
		);
	}
	const n = item.notification;
	const step = nextStepOf(n, item.unread, pending);
	return (
		<Row
			dot={item.unread ? "Unread" : null}
			mark={<NotificationMark n={n} />}
			title={n.title}
			detail={[n.body, whenOf(item.at)].filter(Boolean).join(" · ")}
			product={item.product}
			action={
				<NextStepButton n={n} unread={item.unread} step={step} acts={acts} />
			}
		/>
	);
}

function NextStepButton({
	n,
	unread,
	step,
	acts,
}: {
	n: Notification;
	unread: boolean;
	step: NextStep;
	acts: InboxActs;
}) {
	if (step.kind === "none") return null;
	const open = (go: () => void) => () => {
		if (unread) acts.markRead([n.id]);
		go();
	};
	const [label, onClick] =
		step.kind === "review"
			? ["Review", open(() => acts.review(step.approval))]
			: step.kind === "run"
				? ["Open run", open(() => acts.openRun(step.id))]
				: step.kind === "schedule"
					? ["Open", open(() => acts.openSchedule(step.id))]
					: ["Mark read", () => acts.markRead([n.id])];
	return (
		<Button variant="outline" size="sm" onClick={onClick}>
			{label}
		</Button>
	);
}

function NotificationMark({ n }: { n: Notification }) {
	if (/·\s*failed$/.test(n.title))
		return <StatusIcon state="error" label="Failed" />;
	const Icon = KIND_ICON[n.kind] ?? Bell;
	return <Icon className="size-4 text-muted-foreground" />;
}

function whenOf(at: number): string | null {
	return at ? formatRelativeTime(new Date(at)) : null;
}

function Row({
	dot,
	mark,
	title,
	detail,
	product,
	action,
}: {
	/** The dot's name when the row counts toward the bell, else null. */
	dot: string | null;
	mark: ReactNode;
	title: string;
	detail: string;
	product: ProductId | null;
	action: ReactNode;
}) {
	const products = useProducts();
	const productName = product
		? (products.find((p) => p.id === product)?.name ?? product)
		: null;
	return (
		<Item variant={dot ? "muted" : "default"} size="sm">
			<ItemMedia className="flex-row items-center gap-2">
				<StatusDot
					tone="info"
					size="sm"
					label={dot ?? undefined}
					className={dot ? undefined : "invisible"}
				/>
				{mark}
			</ItemMedia>
			<ItemContent className="min-w-0">
				<ItemTitle className="truncate">{title}</ItemTitle>
				{detail && (
					<ItemDescription className="truncate">{detail}</ItemDescription>
				)}
			</ItemContent>
			<ItemActions>
				{productName && <Badge variant="outline">{productName}</Badge>}
				{action}
			</ItemActions>
		</Item>
	);
}
