/** This Graph's MCP server, as the engine serves it under `…/connections/server`. */

import type { Page } from "@invana-studio/core";

/** The endpoint card, the Claude Code line and the head's counts. */
export interface McpServerInfo {
	url: string;
	transport: string;
	protocol_version: string;
	/** The `claude mcp add` line for this Graph, built by the engine. */
	connect_command: string;
	agents_served: number;
	functions_served: number;
	/** Runs triggered over MCP since 00:00 UTC. */
	calls_today: number;
}

export type ServedKind = "agent" | "function";

/** One agent or function the server may serve, and whether it does. */
export interface ServedRead {
	kind: ServedKind;
	/** The agent's id, or the function's key. */
	ref: string;
	name: string;
	tool: string;
	does: string;
	served: boolean;
	/** An agent's status; null for a function. */
	status: string | null;
	changed_at: string | null;
}

/** One call over the server — a run. */
export interface McpCallRead {
	run_id: string;
	number: number | null;
	at: string;
	caller: string;
	client: string;
	token: string | null;
	tool: string;
	status: string;
	/** The one-line outcome the engine stored when the run settled. */
	result: string | null;
}

export type ServedPage = Page<ServedRead>;
export type McpCallPage = Page<McpCallRead>;
