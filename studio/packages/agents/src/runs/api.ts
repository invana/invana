/**
 * The run page's endpoints under `/api/v1/u/{owner}/{graph}/runs/{id}`:
 * overview, agents, stages, assets and what it touched. The list, stats,
 * cancel and rerun are the core `runsApi`, which every product shares.
 */

import { request } from "@invana-studio/core";
import type {
	RunAgents,
	RunAsset,
	RunOverview,
	RunStages,
	RunTouched,
} from "./types";

const runBase = (username: string, graphSlug: string, id: string) =>
	`/api/v1/u/${username}/${graphSlug}/runs/${id}`;

export const runPageApi = {
	/** Head, tiles and the Overview's series — the large-run reading past 50 agents. */
	overview: (username: string, graphSlug: string, id: string) =>
		request<RunOverview>(`${runBase(username, graphSlug, id)}/overview`),

	/** Who spawned whom, pending delegation asks, and agents grouped by role. */
	agents: (username: string, graphSlug: string, id: string) =>
		request<RunAgents>(`${runBase(username, graphSlug, id)}/agents`),

	/** One card per stage, in plan order. */
	stages: (username: string, graphSlug: string, id: string) =>
		request<RunStages>(`${runBase(username, graphSlug, id)}/stages`),

	/** Everything the run produced. */
	assets: (username: string, graphSlug: string, id: string) =>
		request<{ items: RunAsset[] }>(
			`${runBase(username, graphSlug, id)}/assets`,
		),

	/** Graph data, web, LLM and secrets the run touched. */
	touched: (username: string, graphSlug: string, id: string) =>
		request<RunTouched>(`${runBase(username, graphSlug, id)}/touched`),
};
