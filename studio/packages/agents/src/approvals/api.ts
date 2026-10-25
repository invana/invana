/**
 * Alert rules under `/api/v1/u/{owner}/{graph}/alert-rules`. The asks are the
 * shell's `approvalsApi`, shared with the bell's tray.
 */

import { request } from "@invana-studio/core";
import type { AlertRule, AlertRuleCreate, AlertRuleUpdate } from "./types";

const base = (username: string, graphSlug: string) =>
	`/api/v1/u/${username}/${graphSlug}/alert-rules`;

const json = (body: unknown) => ({ body: JSON.stringify(body) });

export const alertRulesApi = {
	list: (username: string, graphSlug: string) =>
		request<AlertRule[]>(base(username, graphSlug)),

	create: (username: string, graphSlug: string, data: AlertRuleCreate) =>
		request<AlertRule>(base(username, graphSlug), {
			method: "POST",
			...json(data),
		}),

	update: (
		username: string,
		graphSlug: string,
		id: string,
		data: AlertRuleUpdate,
	) =>
		request<AlertRule>(`${base(username, graphSlug)}/${id}`, {
			method: "PATCH",
			...json(data),
		}),

	remove: (username: string, graphSlug: string, id: string) =>
		request<void>(`${base(username, graphSlug)}/${id}`, { method: "DELETE" }),
};
