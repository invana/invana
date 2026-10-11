/**
 * What the setup surfaces borrow from the page that hosts them.
 *
 * A step is skipped or taken back through the Graph's own write, and a step
 * opens the panel that already owns its field. Both belong to the graph page,
 * and the shell may import neither — so the host hands them in once, through
 * `SetupSlotsContext.Provider`, and the board, the lesson, the timeline and
 * the lock read them with `useSetupSlots()`.
 *
 * The hooks are called like any hook, so the host passes the same functions on
 * every render: a module-level object, not one built inline.
 */

import type { SetupSection } from "@invana-studio/core";
import { createContext, useContext } from "react";

/**
 * The `leftNav` keys a setup step, an offer or a lock opens. The host's
 * section setter has to accept every one of them.
 */
export type SetupTarget =
	| "info"
	| "settings"
	| "model"
	| "runs"
	| "agents"
	| "skills"
	| "sessions"
	| "library"
	| "projects"
	| "events";

export interface SetupSlots {
	/** Skips an optional step, or takes the skip back. */
	useSetupSectionMutation: () => {
		mutate: (
			variables: {
				username: string;
				graphSlug: string;
				section: SetupSection;
				action: "skip" | "reset";
			},
			options?: { onError?: (err: Error) => void },
		) => void;
	};
	/** Switches the left column to a section, and that section's tab, in place. */
	useOpenSection: () => (section: SetupTarget, tab?: string) => void;
}

export const SetupSlotsContext = createContext<SetupSlots | null>(null);

/** The host's slots. Throws outside a host, where a step could not open. */
export function useSetupSlots(): SetupSlots {
	const slots = useContext(SetupSlotsContext);
	if (!slots) throw new Error("Setup renders inside SetupSlotsContext.");
	return slots;
}
