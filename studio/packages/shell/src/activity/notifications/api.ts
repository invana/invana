/**
 * Notifications and approvals API clients
 * (docs/for-developers/modules/operate/features/notifications.md ·
 * approvals.md).
 *
 * | Client | Path under `/api/v1/u/:username/:graphSlug` |
 * |---|---|
 * | `notificationsApi` | `/notifications` (the inbox) · `/read` · `/rules` · `/channels` |
 * | `approvalsApi` | `/approvals` · `/{id}/approve` · `/{id}/decline` |
 */

import { ApiError, apiClient, type GraphRef } from "@invana-studio/core";
import type {
	Approval,
	ApprovalListResponse,
	ApprovalStatus,
	Channel,
	ChannelListResponse,
	ChannelWrite,
	InboxResponse,
	NotificationRule,
	NotificationRuleListResponse,
	NotificationRuleUpdate,
	NotificationRuleWrite,
} from "./types";

const graphBase = (g: GraphRef) => `/api/v1/u/${g.username}/${g.graphSlug}`;
const base = (g: GraphRef) => `${graphBase(g)}/notifications`;

export const notificationsApi = {
	async inbox(
		g: GraphRef,
		opts: { unread?: boolean; limit?: number } = {},
	): Promise<InboxResponse> {
		const q = new URLSearchParams();
		if (opts.unread) q.set("unread", "true");
		q.set("limit", String(opts.limit ?? 100));
		return (await apiClient.get<InboxResponse>(`${base(g)}?${q}`)).data;
	},
	/** Marks these notifications read; no ids marks every unread one. */
	async markRead(g: GraphRef, ids?: string[]): Promise<{ marked: number }> {
		return (
			await apiClient.post<{ marked: number }>(`${base(g)}/read`, {
				ids: ids ?? null,
			})
		).data;
	},
	async rules(g: GraphRef): Promise<NotificationRuleListResponse> {
		return (
			await apiClient.get<NotificationRuleListResponse>(`${base(g)}/rules`)
		).data;
	},
	async createRule(
		g: GraphRef,
		body: NotificationRuleWrite,
	): Promise<NotificationRule> {
		return (await apiClient.post<NotificationRule>(`${base(g)}/rules`, body))
			.data;
	},
	async updateRule(
		g: GraphRef,
		id: string,
		body: NotificationRuleUpdate,
	): Promise<NotificationRule> {
		return (
			await apiClient.patch<NotificationRule>(`${base(g)}/rules/${id}`, body)
		).data;
	},
	async deleteRule(g: GraphRef, id: string): Promise<void> {
		await apiClient.delete(`${base(g)}/rules/${id}`);
	},
	async channels(g: GraphRef): Promise<ChannelListResponse> {
		return (await apiClient.get<ChannelListResponse>(`${base(g)}/channels`))
			.data;
	},
	async createChannel(g: GraphRef, body: ChannelWrite): Promise<Channel> {
		return (await apiClient.post<Channel>(`${base(g)}/channels`, body)).data;
	},
	async deleteChannel(g: GraphRef, id: string): Promise<void> {
		await apiClient.delete(`${base(g)}/channels/${id}`);
	},
};

export const approvalsApi = {
	async list(
		g: GraphRef,
		opts: { mine?: boolean; status?: ApprovalStatus } = {},
	): Promise<ApprovalListResponse> {
		const q = new URLSearchParams();
		if (opts.mine) q.set("mine", "true");
		if (opts.status) q.set("status", opts.status);
		return (
			await apiClient.get<ApprovalListResponse>(
				`${graphBase(g)}/approvals?${q}`,
			)
		).data;
	},
	async get(g: GraphRef, id: string): Promise<Approval> {
		return (await apiClient.get<Approval>(`${graphBase(g)}/approvals/${id}`))
			.data;
	},
	async approve(g: GraphRef, id: string, note = ""): Promise<Approval> {
		return (
			await apiClient.post<Approval>(
				`${graphBase(g)}/approvals/${id}/approve`,
				{ note },
			)
		).data;
	},
	async decline(g: GraphRef, id: string, note = ""): Promise<Approval> {
		return (
			await apiClient.post<Approval>(
				`${graphBase(g)}/approvals/${id}/decline`,
				{ note },
			)
		).data;
	},
};

/**
 * The engine's refusal, in its own words: a string `detail`, a `{ message }`,
 * or a validation list whose first entry names the field.
 */
export function refusalOf(
	err: unknown,
	fallback = "The write was refused.",
): string {
	if (err instanceof ApiError) {
		const d = err.detail as unknown;
		if (typeof d === "string") return d;
		if (Array.isArray(d) && d.length) {
			const first = d[0] as { loc?: unknown[]; msg?: string };
			const field = first.loc?.filter((p) => p !== "body").join(".");
			return field
				? `${field}: ${first.msg ?? "invalid"}`
				: (first.msg ?? fallback);
		}
		if (d && typeof d === "object" && "message" in d)
			return String((d as { message: unknown }).message);
		return err.message || fallback;
	}
	return err instanceof Error ? err.message : fallback;
}
