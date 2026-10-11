/**
 * What the Agents product borrows from the app that hosts it.
 *
 * - `Page` — the page the product's routes render: the app's product host,
 *   which composes every graph product's regions.
 *
 * The app provides `AgentsSlotsContext` once, around the shell, with a
 * module-level object, so the component it carries is the same on every
 * render.
 */

import { type ComponentType, createContext, useContext } from "react";

export interface AgentsSlots {
	/** The page the product's routes render. */
	Page: ComponentType;
}

export const AgentsSlotsContext = createContext<AgentsSlots | null>(null);

/** The host's slots. Throws outside a host, where the product could not render. */
export function useAgentsSlots(): AgentsSlots {
	const slots = useContext(AgentsSlotsContext);
	if (!slots)
		throw new Error("The Agents product renders inside AgentsSlotsContext.");
	return slots;
}
