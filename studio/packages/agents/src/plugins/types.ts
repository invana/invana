/**
 * A function's page as the engine returns it. The plugin registry's types
 * are core's (`PluginSummary`, `PluginDetail`, `McpServerRead`).
 *
 * A function's page is Graph-scoped —
 * `GET …/catalogue/{step_key}` and its `…/calls` — because who names a
 * function and how its calls went are a Graph's facts.
 */

import type { Change, Page } from "@invana-studio/core";
import type { CatalogueEntry } from "../plans/types";

interface FunctionPlanRef {
	id: string;
	key: string;
	name: string;
	/** `packaged` · `generated` · `promoted`. */
	origin: string;
}

/** A skill whose current version's plan names the function. */
interface FunctionSkillRef {
	skill_id: string;
	name: string;
	version: number;
}

/** The function's calls over the window against the window before — the engine's numbers. */
export interface FunctionCalls {
	days: number;
	since: string;
	calls: number;
	calls_prior: number;
	calls_change: Change | null;
	/** Queued to finished over settled calls; null when none settled. */
	p95_ms: number | null;
	p95_prior_ms: number | null;
	p95_change: Change | null;
	failed: number;
	/** Failed over settled; null when none settled. */
	failed_rate: number | null;
	failed_rate_prior: number | null;
	failed_rate_change: Change | null;
}

/** A function's page: its catalogue entry, its manifest, who names it and its calls. */
export interface FunctionRead extends Omit<CatalogueEntry, "plugin"> {
	/** `name@version` of the plugin that declares it. */
	plugin: string;
	version: string;
	side_effect: string;
	resources: string[];
	/** Declared on the manifest; null is the engine's default. */
	timeout_s: number | null;
	retries: number | null;
	plans: FunctionPlanRef[];
	needed_by: FunctionSkillRef[];
	calls: FunctionCalls;
}

/** One run step that called the function. */
interface FunctionCallRead {
	/** The step's `task_runs.id`. */
	id: string;
	/** The run the step ran in. */
	run_id: string;
	title: string;
	status: string;
	duration_ms: number | null;
	tokens: number | null;
	queued_at: string;
}

/** A function's calls, newest first. Filter: `status`. */
export type FunctionCallsPage = Page<FunctionCallRead>;
