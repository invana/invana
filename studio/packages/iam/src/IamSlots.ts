/**
 * What the IAM product borrows from the app that hosts it.
 *
 * - `Page` — the page the product's routes render: the app's product host,
 *   which composes every graph product's regions.
 *
 * The app provides `IamSlotsContext` once, around the shell, with a
 * module-level object, so the component it carries is the same on every
 * render.
 */

import { type ComponentType, createContext, useContext } from "react";

export interface IamSlots {
	/** The page the product's routes render. */
	Page: ComponentType;
}

export const IamSlotsContext = createContext<IamSlots | null>(null);

/** The host's slots. Throws outside a host, where the product could not render. */
export function useIamSlots(): IamSlots {
	const slots = useContext(IamSlotsContext);
	if (!slots)
		throw new Error("The IAM product renders inside IamSlotsContext.");
	return slots;
}
