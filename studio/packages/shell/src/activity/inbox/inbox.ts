/**
 * The Inbox: what needs a person on this Graph, from three reads.
 *
 * | Row | From | Order | Next step |
 * |---|---|---|---|
 * | approval | approvals waiting on me (`mine`, `pending`) | soonest deadline first | Review |
 * | waiting | runs `awaiting_input` in the Graph's last 100 runs — no event says so | newest first | Answer |
 * | notification | `GET …/notifications` — what rules, schedules and approvals told me | newest first | open its target |
 *
 * A run held on an approval shows once, as the approval.
 *
 * Failed runs arrive as notifications, through a rule; nothing here derives
 * them from the journal, so no failure shows twice. The count the bell and
 * the Inbox tab carry is unread notifications + approvals + waiting runs.
 */
import type { ProductId, TaskRunSummary } from "@invana-studio/core";
import type { Approval, Notification } from "../notifications/types";

export type InboxItem =
	| { kind: "approval"; id: string; at: number; approval: Approval }
	| {
			kind: "waiting";
			id: string;
			at: number;
			run: TaskRunSummary;
			product: ProductId;
	  }
	| {
			kind: "notification";
			id: string;
			at: number;
			notification: Notification;
			/** Null for the shell's own records: a schedule, approval, rule or channel. */
			product: ProductId | null;
			unread: boolean;
	  };

/**
 * Which product a run came from: a load is Datasets', a Todo's run Projects',
 * a stitch Modeller's. A typed query (`ql`) is the person's even when an agent
 * carried it, so it is Explorer's; any other run an agent performed is the
 * agent's. What is left — an unagented `nl` ask, a canvas act, a run that
 * predates the column — is Explorer's.
 */
export function productOfRun(run: TaskRunSummary): ProductId {
	if (run.kind === "import" || run.kind === "bulk") return "datasets";
	if (run.task_id) return "projects";
	if (run.kind === "stitch") return "modeller";
	if (run.kind === "ql") return "explorer";
	if (run.agent_id) return "agents";
	return "explorer";
}

const TARGET_PRODUCT: Record<string, ProductId> = {
	agent: "agents",
	skill: "agents",
	flow: "agents",
	eval_set: "agents",
	llm_provider: "agents",
	llm_model: "agents",
	graph_model: "modeller",
	model_link: "modeller",
	projection_template: "modeller",
	rule: "modeller",
	lens: "modeller",
	connection: "modeller",
	project: "projects",
	task: "projects",
	dataset: "datasets",
	standard: "datasets",
	session: "explorer",
	query: "explorer",
	board: "explorer",
	run: "explorer",
};

/**
 * A notification's product: its run's when the run is among the recent ones,
 * else its target's; a schedule, approval, rule or channel has none.
 */
function productOfNotification(
	n: Notification,
	runs: readonly TaskRunSummary[],
): ProductId | null {
	if (n.run_id) {
		const run = runs.find((r) => r.id === n.run_id);
		if (run) return productOfRun(run);
	}
	return n.target_kind ? (TARGET_PRODUCT[n.target_kind] ?? null) : null;
}

function timeOf(run: TaskRunSummary): number {
	const iso = run.finished_at ?? run.started_at ?? run.queued_at;
	return iso ? new Date(iso).getTime() : 0;
}

export function inboxOf(
	approvals: readonly Approval[],
	runs: readonly TaskRunSummary[],
	notifications: readonly Notification[],
): InboxItem[] {
	const a: InboxItem[] = approvals
		.filter((x) => x.status === "pending")
		.map((approval) => ({
			kind: "approval" as const,
			id: `approval:${approval.id}`,
			at: new Date(approval.deadline_at).getTime(),
			approval,
		}))
		.sort((x, y) => x.at - y.at);
	// A run held on an approval is waiting too; its approval row already asks.
	const held = new Set(approvals.map((x) => x.run_id).filter(Boolean));
	const w: InboxItem[] = runs
		.filter((r) => r.status === "awaiting_input" && !held.has(r.id))
		.map((run) => ({
			kind: "waiting" as const,
			id: `run:${run.id}`,
			at: timeOf(run),
			run,
			product: productOfRun(run),
		}))
		.sort((x, y) => y.at - x.at);
	const n: InboxItem[] = notifications
		.map((notification) => ({
			kind: "notification" as const,
			id: `notification:${notification.id}`,
			at: new Date(notification.created_at).getTime(),
			notification,
			product: productOfNotification(notification, runs),
			unread: !notification.read_at,
		}))
		.sort((x, y) => y.at - x.at);
	return [...a, ...w, ...n];
}

/** What the bell and the Inbox tab count. */
export function inboxCount(items: readonly InboxItem[]): number {
	return items.filter((i) => i.kind !== "notification" || i.unread).length;
}

/** A run's name on a row: what the opener wrote, else its Todo, else its plan. */
export function runTitle(run: TaskRunSummary): string {
	return run.body ?? run.task_title ?? run.flow_key;
}
