/**
 * What the runs surfaces borrow from the page that hosts them. The events
 * surfaces borrow nothing, so the platform's own page renders without a host.
 *
 * A run names the agent that started it, reads what it touched off the
 * Graph's govern ledger, keeps a reading of its board as a report, and opens
 * the lens it ran in where that lens is edited. Each of those belongs to
 * another part of Studio, and the shell may import none of them — so the host
 * hands them in once, through `ActivitySlotsContext.Provider`, and the
 * components read them with `useActivitySlots()`.
 *
 * The hooks are called like any hook, so the host passes the same functions on
 * every render: a module-level object, not one built inline.
 */

import type { BoardSpec, ExtraPanels } from "@invana/boards";
import type { LensKind, TouchesResponse } from "@invana-studio/core";
import { createContext, useContext } from "react";
import type { NavigateOptions } from "react-router-dom";

/** A board's spec with `Save report` on its header, and the act behind it. */
interface ActivityReport<X extends ExtraPanels> {
	spec: BoardSpec<X>;
	/** Answers the action if it is one of the report's, and says so. */
	handle: (actionId: string) => boolean;
}

type PageParamsUpdate =
	| URLSearchParams
	| ((prev: URLSearchParams) => URLSearchParams);

export interface ActivitySlots {
	/** The Graph's agents, for the name a run's row and filter show. */
	useAgents: (
		username: string | undefined,
		graphSlug: string | undefined,
	) => { data?: { items: readonly { id: string; name: string }[] } };
	/** What one run touched, projected from the ledger. */
	useRunTouches: (
		username: string | undefined,
		graphSlug: string | undefined,
		runId: string | undefined,
	) => {
		data?: TouchesResponse;
		isLoading: boolean;
		isFetching: boolean;
		refetch: () => Promise<unknown>;
	};
	/** `Save report` and `Reports` on a declared board's header. */
	useReport: <X extends ExtraPanels>(
		spec: BoardSpec<X> | null,
	) => ActivityReport<X> | null;
	/** Opens the Govern panel on one lens, from anywhere on the page. */
	useLensesViewPanel: () => {
		reveal: (kind: LensKind, id: string) => void;
	};
	/** The page's params, read from its path, and a stable writer for them. */
	usePageParams: () => [
		URLSearchParams,
		(next: PageParamsUpdate, options?: NavigateOptions) => void,
	];
}

export const ActivitySlotsContext = createContext<ActivitySlots | null>(null);

/** The host's slots. Throws outside a host, where a run could not render. */
export function useActivitySlots(): ActivitySlots {
	const slots = useContext(ActivitySlotsContext);
	if (!slots)
		throw new Error("The runs surfaces render inside ActivitySlotsContext.");
	return slots;
}
