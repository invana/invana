/**
 * What the Activity product borrows from the app that hosts it.
 *
 * - `Page` — the page the product's routes render: the app's product host,
 *   which composes every graph product's regions.
 * - `useRailCounts` — the counts the rail pins to Runs and Approvals: the
 *   runs live now and the asks waiting for the reader. Both are read by the
 *   agents package's own queries, which this product may not import, so the
 *   app hands the hook in.
 *
 * The app provides `ActivityProductSlotsContext` once, around the shell, with
 * a module-level object, so the hook and the component it carries are the
 * same on every render. (The shell's `ActivitySlotsContext` is another thing:
 * what a run's boards borrow.)
 */

import { type ComponentType, createContext, useContext } from "react";

export interface ActivityProductSlots {
	/** The page the product's routes render. */
	Page: ComponentType;
	/** Runs live now and asks waiting for the reader, on the open Graph. */
	useRailCounts: () => { runs?: number; approvals?: number };
}

export const ActivityProductSlotsContext =
	createContext<ActivityProductSlots | null>(null);

/** The host's slots. Throws outside a host, where the product could not render. */
export function useActivityProductSlots(): ActivityProductSlots {
	const slots = useContext(ActivityProductSlotsContext);
	if (!slots)
		throw new Error(
			"The Activity product renders inside ActivityProductSlotsContext.",
		);
	return slots;
}
