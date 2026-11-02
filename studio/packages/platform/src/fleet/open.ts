/**
 * How a Fleet page opens a pool, a worker or another tab, without knowing
 * where the workbook keeps them. `FleetPage` provides one `FleetOpenContext`
 * around the workbook; a page deep under it calls `useFleetOpen()`.
 */
import { createContext, useContext } from "react";
import type { FleetTab } from "./section";

export interface FleetOpen {
	/** A worker pool's page, by its name. */
	pool: (name: string) => void;
	/** A worker's page, by its name. */
	worker: (name: string) => void;
	/** One of the Workers page's tabs. */
	tab: (tab: FleetTab) => void;
}

export const FleetOpenContext = createContext<FleetOpen | null>(null);

/** The workbook's openers. Throws outside Fleet, where nothing could open. */
export function useFleetOpen(): FleetOpen {
	const open = useContext(FleetOpenContext);
	if (!open) throw new Error("A Fleet page renders inside FleetOpenContext.");
	return open;
}
