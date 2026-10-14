/**
 * What the Inbox tab draws from `InboxItem`s, kept free of React so it reads
 * and tests on its own.
 *
 * | Helper | Answers |
 * |---|---|
 * | `productsIn` | which products the product filter offers — only those present |
 * | `filterInbox` | the rows a product filter and *Unread* leave |
 * | `nextStepOf` | a notification's one button: *Review* · *Open run* · *Open* · *Mark read* |
 * | `timeLeft` | an approval's deadline as time left, or null once it has passed |
 * | `payloadSections` | an approval's payload as label/value rows, nothing hidden |
 *
 * *Unread* hides read notifications only: an approval or a run waiting on an
 * answer always needs the person, so it stays. A product filter keeps only
 * rows from that product, so the shell's own rows (approvals, schedule
 * notices) leave with it.
 */
import type { ProductId } from "@invana-studio/core";
import type { Approval, Notification } from "../notifications/types";
import type { InboxItem } from "./inbox";

export interface InboxFilter {
	/** One product, or null for every product. */
	product: ProductId | null;
	/** Hide notifications already read. */
	unreadOnly: boolean;
}

/** A row's product, or null for the shell's own records. */
function productOfItem(item: InboxItem): ProductId | null {
	return item.kind === "approval" ? null : item.product;
}

/** The products present among the rows, in first-seen order. */
export function productsIn(items: readonly InboxItem[]): ProductId[] {
	const seen: ProductId[] = [];
	for (const item of items) {
		const p = productOfItem(item);
		if (p && !seen.includes(p)) seen.push(p);
	}
	return seen;
}

export function filterInbox(
	items: readonly InboxItem[],
	filter: InboxFilter,
): InboxItem[] {
	return items.filter((item) => {
		if (filter.product && productOfItem(item) !== filter.product) return false;
		if (filter.unreadOnly && item.kind === "notification" && !item.unread)
			return false;
		return true;
	});
}

export type NextStep =
	| { kind: "review"; approval: Approval }
	| { kind: "run"; id: string }
	| { kind: "schedule"; id: string }
	| { kind: "mark-read" }
	| { kind: "none" };

/**
 * Where a notification leads. An approval still waiting comes first — it is
 * the one that needs a decision — then the run, then the schedule. A rule's
 * notice names its record by target, so a `schedule` or `run` target counts
 * as one. With no target, an unread row is marked read in place.
 */
export function nextStepOf(
	n: Notification,
	unread: boolean,
	pending: readonly Approval[],
): NextStep {
	const approval = n.approval_id
		? pending.find((a) => a.id === n.approval_id)
		: undefined;
	if (approval) return { kind: "review", approval };
	const runId = n.run_id ?? (n.target_kind === "run" ? n.target_id : null);
	if (runId) return { kind: "run", id: runId };
	const scheduleId =
		n.schedule_id ?? (n.target_kind === "schedule" ? n.target_id : null);
	if (scheduleId) return { kind: "schedule", id: scheduleId };
	return unread ? { kind: "mark-read" } : { kind: "none" };
}

/** `5 min` · `5 h` · `3 d` until the deadline, or null once it has passed. */
export function timeLeft(deadlineIso: string, now = Date.now()): string | null {
	const ms = new Date(deadlineIso).getTime() - now;
	if (!(ms > 0)) return null;
	const minutes = Math.ceil(ms / 60_000);
	if (minutes < 60) return `${minutes} min`;
	const hours = Math.floor(minutes / 60);
	if (hours < 48) return `${hours} h`;
	return `${Math.floor(hours / 24)} d`;
}

interface PayloadRow {
	label: string;
	value: string;
}

export interface PayloadSection {
	/** The channel it goes to — `#deals · slack` — or null for a flat payload. */
	heading: string | null;
	rows: PayloadRow[];
}

/** The keys a person reads first, in reading order, with their labels. */
const KNOWN: [key: string, label: string][] = [
	["channel", "Channel"],
	["kind", "Kind"],
	["target", "To"],
	["recipients", "To"],
	["subject", "Subject"],
	["title", "Title"],
	["text", "Text"],
	["body", "Body"],
	["link", "Link"],
];

function asText(v: unknown): string | null {
	if (typeof v === "string") return v || null;
	if (typeof v === "number" || typeof v === "boolean") return String(v);
	if (Array.isArray(v) && v.every((x) => typeof x === "string"))
		return v.length ? v.join(", ") : null;
	return null;
}

function rowsOf(o: Record<string, unknown>, skip: string[] = []): PayloadRow[] {
	return KNOWN.filter(([key]) => !skip.includes(key)).flatMap(
		([key, label]) => {
			const value = asText(o[key]);
			return value ? [{ label, value }] : [];
		},
	);
}

/**
 * An approval's payload as rows. A held delivery carries `channels` — one
 * entry per channel with the rendered message under `payload` — and each
 * becomes a section; any other payload is read flat. Keys not listed here are
 * left to the full payload drawn beside these rows.
 */
export function payloadSections(
	payload: Record<string, unknown>,
): PayloadSection[] {
	const channels = payload.channels;
	if (Array.isArray(channels)) {
		return channels
			.filter((c): c is Record<string, unknown> => !!c && typeof c === "object")
			.map((c) => {
				const inner =
					c.payload && typeof c.payload === "object"
						? (c.payload as Record<string, unknown>)
						: {};
				const name = asText(c.channel);
				const kind = asText(c.kind);
				return {
					heading: [name, kind].filter(Boolean).join(" · ") || null,
					rows: [...rowsOf(c, ["channel", "kind"]), ...rowsOf(inner)],
				};
			});
	}
	const rows = rowsOf(payload);
	return rows.length ? [{ heading: null, rows }] : [];
}
