/**
 * What the Projects product borrows from the app that hosts it.
 *
 * - `Page` — the page the product's routes render: the app's product host,
 *   which composes every graph product's regions.
 * - `useAgents` — the Graph's agents, the people a Todo can be handed to. The
 *   agents list belongs to the Agents product, which this product may not
 *   import, so the host lends its query.
 *
 * The app provides `ProjectsSlotsContext` once, around the shell, with a
 * module-level object, so the hooks and component it carries are the same on
 * every render.
 */

import { type ComponentType, createContext, useContext } from "react";

export interface ProjectsSlots {
	/** The page the product's routes render. */
	Page: ComponentType;
	/** The Graph's agents, for the assignee a Todo can be handed to. */
	useAgents: (
		username: string | undefined,
		graphSlug: string | undefined,
	) => {
		data?: { items: readonly { id: string; name: string; status: string }[] };
	};
}

export const ProjectsSlotsContext = createContext<ProjectsSlots | null>(null);

/** The host's slots. Throws outside a host, where the product could not render. */
export function useProjectsSlots(): ProjectsSlots {
	const slots = useContext(ProjectsSlotsContext);
	if (!slots)
		throw new Error(
			"The Projects product renders inside ProjectsSlotsContext.",
		);
	return slots;
}
