/**
 * What the Modeller borrows from the app that hosts it.
 *
 * - `Page` — the page the Modeller's routes render. It is today's graph page,
 *   which draws every region and still lives in the app; when that page is
 *   retired, the Modeller's own page moves here and the slot goes.
 *
 * The app provides `ModellerSlotsContext` once, around the shell, with a
 * module-level object, so the components it carries are the same on every
 * render.
 */

import { type ComponentType, createContext, useContext } from "react";

export interface ModellerSlots {
	/** The page the Modeller's routes render. */
	Page: ComponentType;
}

export const ModellerSlotsContext = createContext<ModellerSlots | null>(null);

/** The host's slots. Throws outside a host, where the Modeller could not render. */
export function useModellerSlots(): ModellerSlots {
	const slots = useContext(ModellerSlotsContext);
	if (!slots)
		throw new Error("The Modeller renders inside ModellerSlotsContext.");
	return slots;
}
