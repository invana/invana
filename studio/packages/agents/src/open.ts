/**
 * How an Agents page opens a record or another section, without knowing where
 * the host keeps its tabs.
 *
 * A row opens its record's page as a tab of its own, after the section's tab
 * (the-agents-shell.md); a link to a section moves the path. The host provides
 * one `AgentsOpenContext` around the workbook, so a page deep under a section
 * calls `useAgentsOpen()` rather than threading callbacks.
 */

import { createContext, useContext } from "react";
import type { AgentsSectionKey } from "./sections/spec";

export interface AgentsOpen {
	/** An agent's page, by `agents.id`. */
	agent: (id: string) => void;
	/** A skill's page, by `skills.id`. */
	skill: (id: string) => void;
	/** A function's page, by its dotted name. */
	func: (key: string) => void;
	/** A plugin's page, by its name. */
	plugin: (name: string) => void;
	/** A plan's page, by `flows.id`. */
	plan: (id: string) => void;
	/** An answer template's page, by its id. */
	template: (id: string) => void;
	/** A run's page, by its root `task_runs.id`. */
	run: (id: string) => void;
	/** Another Agents section, on one of its tabs. */
	section: (key: AgentsSectionKey, tab?: string) => void;
}

export const AgentsOpenContext = createContext<AgentsOpen | null>(null);

/** The host's openers. Throws outside the Agents workbook, where nothing could open. */
export function useAgentsOpen(): AgentsOpen {
	const open = useContext(AgentsOpenContext);
	if (!open)
		throw new Error("An Agents page renders inside AgentsOpenContext.");
	return open;
}
