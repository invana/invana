/**
 * What the Modeller borrows from the page that hosts it.
 *
 * The models page names the Graph's connector and re-reads the database's
 * physical schema, and the property editor offers only the property types the
 * bound backend supports. All three read the Graph's connection, which belongs
 * to the Graph's settings — and the Modeller may not import the app that holds
 * them today. So the host hands them in once, through
 * `ModellerSlotsContext.Provider`, and the components read them with
 * `useModellerSlots()`.
 *
 * The hooks are called like any hook, so the host passes the same functions on
 * every render: a module-level object, not one built inline.
 */

import type { GraphConnectionRead } from "@invana-studio/core";
import { createContext, useContext } from "react";

export interface ModellerSlots {
	/** The Graph's connection: its connector and what the backend supports. */
	useGraphConnectionQuery: (
		username: string | undefined,
		graphSlug: string | undefined,
	) => { data?: GraphConnectionRead | null };
	/** Asks the engine to re-read what the database holds. */
	introspectConnection: (
		username: string,
		graphSlug: string,
	) => Promise<unknown>;
}

export const ModellerSlotsContext = createContext<ModellerSlots | null>(null);

/** The host's slots. Throws outside a host, where a model page could not render. */
export function useModellerSlots(): ModellerSlots {
	const slots = useContext(ModellerSlotsContext);
	if (!slots)
		throw new Error("The Modeller renders inside ModellerSlotsContext.");
	return slots;
}
