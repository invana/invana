/**
 * The plugin registry as the engine returns it — `GET /api/v1/plugins`,
 * `GET /api/v1/plugins/{name}` — and an MCP server as adding or refreshing
 * one returns it. Install-level, not Graph-scoped: the registry is the
 * process's, the same for every Graph. Settings lists and switches it; the
 * Agents product reads it for MCP servers and the functions' plugins.
 */

import type { Page } from "./list";

/** `core` · `simulator` · `tool` · `mcp`. */
type PluginKind = "core" | "simulator" | "tool" | "mcp";

export interface PluginBase {
	name: string;
	kind: PluginKind;
	version: string;
	title: string;
	/** The pip extra that installs it; empty for a core plugin. */
	extra: string;
	installed: boolean;
	enabled: boolean;
	/** Whether an install Admin may enable or disable it. */
	switchable: boolean;
	/** Stored at a revision this process has not loaded — restart to load it. */
	restart_required: boolean;
}

export interface PluginSummary extends PluginBase {
	/** How many functions it declares. */
	task_types: number;
	skills: number;
	flows: number;
}

/**
 * The registry. Search: name · key. Filters: `kind` · `enabled` (true ·
 * false). Sort: `name`.
 */
export type PluginPage = Page<PluginSummary>;

interface FunctionArg {
	type: string;
	required: boolean;
	default: unknown;
}

/** One function's manifest, as declared on disk. */
interface FunctionManifest {
	key: string;
	version: string;
	summary: string;
	bound: string;
	side_effect: string;
	args: Record<string, FunctionArg>;
	outputs: Record<string, string>;
	requires: string[];
	resources: string[];
	timeout_s: number | null;
	retries: number | null;
}

export interface PluginDetail extends PluginBase {
	/** Names its functions may resolve in a worker — never their values. */
	secrets: string[];
	/** The functions it declares. */
	task_types: FunctionManifest[];
	flows: { key: string; version: number; kind: string; description: string }[];
	skills: {
		slug: string;
		name: string;
		version: number;
		when_to_use: string;
		description: string;
	}[];
}

/** One tool of an MCP server, as frozen. */
interface McpTool {
	key: string;
	version: string;
	/** `read` when the server marks it read-only, else `send`. */
	side_effect: string;
	summary: string;
}

/** An MCP server as stored — what `POST /plugins/mcp` and its refresh return. */
export interface McpServerRead {
	name: string;
	/** `invana.mcp.<name>`. */
	plugin: string;
	url: string;
	revision: number;
	/** The revision this process loaded; null when it loaded none. */
	loaded_revision: number | null;
	restart_required: boolean;
	tools: McpTool[];
	/** Tool names that could not be keyed. */
	skipped: string[];
	frozen_at: string;
}

/** A reusable plan in this Graph naming the function — its newest version. */
