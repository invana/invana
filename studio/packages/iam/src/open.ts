/**
 * How an IAM page opens a record or another section, without knowing where
 * the host keeps its tabs.
 *
 * A row opens its record's page as a tab of its own, after the section's tab;
 * a link to a section moves the path. An agent is built in Agents, so its
 * builder page opens there. The host provides one `IamOpenContext` around the
 * workbook, so a page deep under a section calls `useIamOpen()` rather than
 * threading callbacks.
 */

import { createContext, useContext } from "react";
import type { IamSectionKey } from "./sections/spec";

export interface IamOpen {
	/** A policy's page, by its name. */
	policy: (name: string) => void;
	/** An agent's access page, by `agents.id`. */
	agent: (id: string) => void;
	/** A group's page, by its name. */
	group: (name: string) => void;
	/** Another IAM section. */
	section: (key: IamSectionKey) => void;
	/** The agent's own page in the Agents product, where it is built. */
	agentInAgents: (id: string) => void;
}

export const IamOpenContext = createContext<IamOpen | null>(null);

/** The host's openers. Throws outside the IAM workbook, where nothing could open. */
export function useIamOpen(): IamOpen {
	const open = useContext(IamOpenContext);
	if (!open) throw new Error("An IAM page renders inside IamOpenContext.");
	return open;
}
