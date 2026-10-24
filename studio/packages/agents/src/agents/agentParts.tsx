/**
 * What the agent page's tabs share: the tab list and its URL key, the model
 * versions the Graph's endpoints offer, how a run's exit reads, and the
 * small read states every tab draws the same way.
 */

import type { StatusDotProps } from "@invana/ui";
import { Button, EmptyState, Spinner } from "@invana/ui";
import { CircleAlert } from "lucide-react";
import { useMemo } from "react";
import { EVERY } from "../lists";
import { useLLMProvidersQuery } from "../llms/queries";

/** The eleven tabs, in order; the value is what `?tab=` holds. */
export const AGENT_TABS = [
	{ value: "overview", label: "Overview" },
	{ value: "runs", label: "Runs" },
	{ value: "instructions", label: "Instructions" },
	{ value: "soul", label: "Soul" },
	{ value: "model", label: "Model" },
	{ value: "flow", label: "Flow" },
	{ value: "access", label: "Access" },
	{ value: "limits", label: "Limits" },
	{ value: "deploy", label: "Deploy" },
	{ value: "evals", label: "Evals" },
	{ value: "history", label: "History" },
] as const;

export type AgentTab = (typeof AGENT_TABS)[number]["value"];

export const isAgentTab = (v: string | null): v is AgentTab =>
	AGENT_TABS.some((t) => t.value === v);

/** Every model address the Graph's endpoints offer, once each — what a pin stores. */
export function useOfferedVersions(username: string, graphSlug: string) {
	const providers = useLLMProvidersQuery(username, graphSlug, EVERY);
	const versions = useMemo(
		() =>
			[
				...new Set(
					(providers.data?.items ?? []).flatMap((p) =>
						p.models.filter((m) => m.status === "active").map((m) => m.address),
					),
				),
			].sort(),
		[providers.data],
	);
	return { versions, isLoading: providers.isLoading };
}

/** `llm/anthropic/claude-opus-5-5` → `claude-opus-5-5`: the version a reader names. */
export const versionName = (address: string | null | undefined) =>
	address ? (address.split("/").pop() ?? address) : null;

/** `#a1b2` — a run as a row names it. */
export const runLabel = (id: string) => `#${id.slice(0, 4)}`;

/** An exit's tone: served is good, a failure is bad, the rest are plain. */
export function exitTone(exit: string): NonNullable<StatusDotProps["tone"]> {
	switch (exit) {
		case "answered":
		case "conversed":
		case "succeeded":
			return "success";
		case "running":
		case "queued":
			return "running";
		case "failed":
			return "error";
		case "cannot_answer":
		case "awaiting_input":
		case "awaiting_approval":
			return "warning";
		default:
			return "muted";
	}
}

/** The body while a tab's read is in flight, or the engine's words when it refused. */
export function TabReadState({
	loading,
	error,
	what,
	onRetry,
}: {
	loading: boolean;
	error: unknown;
	/** What is being read — `this agent's numbers`. */
	what: string;
	onRetry?: () => void;
}) {
	if (loading)
		return (
			<div className="flex items-center justify-center p-6">
				<Spinner />
			</div>
		);
	if (!error) return null;
	return (
		<EmptyState
			icon={<CircleAlert className="size-6" />}
			title={`Could not read ${what}`}
			description={error instanceof Error ? error.message : undefined}
			actions={
				onRetry ? (
					<Button variant="outline" size="sm" onClick={onRetry}>
						Try again
					</Button>
				) : undefined
			}
		/>
	);
}
