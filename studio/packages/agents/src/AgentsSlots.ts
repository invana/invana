/**
 * What the Agents product borrows from the app that hosts it.
 *
 * - `Page` — the page the product's routes render: the app's product host,
 *   which composes every graph product's regions.
 * - `AccessPanel` — an agent's policies and the function matrix on its Access
 *   tab. They are IAM's, and a product never imports another, so the host
 *   hands IAM's panel in.
 *
 * The app provides `AgentsSlotsContext` once, around the shell, with a
 * module-level object, so the components it carries are the same on every
 * render.
 */

import { type ComponentType, createContext, useContext } from "react";

export interface AccessPanelProps {
	username: string;
	graphSlug: string;
	agent: { id: string; name: string };
	/** Opens the agent's envelope drawing, on its own page. */
	onOpenEnvelope: () => void;
}

export interface AgentsSlots {
	/** The page the product's routes render. */
	Page: ComponentType;
	/** What the agent holds and may do, as IAM reads it. */
	AccessPanel: ComponentType<AccessPanelProps>;
}

export const AgentsSlotsContext = createContext<AgentsSlots | null>(null);

/** The host's slots. Throws outside a host, where the product could not render. */
export function useAgentsSlots(): AgentsSlots {
	const slots = useContext(AgentsSlotsContext);
	if (!slots)
		throw new Error("The Agents product renders inside AgentsSlotsContext.");
	return slots;
}
