import type { NavHorizontalItem } from "@invana/ui";
import {
	type AccessAreaName,
	type Gate,
	gateOf,
	useAuth,
	useGraphAccessQuery,
} from "@invana-studio/core";
import { useCallback } from "react";
import { useOpenGraph } from "../products";

/**
 * What the signed-in member may change on the open Graph, one area at a time
 * (docs/for-developers/modules/identity-and-access/features/roles.md,
 * shell.md › *Without the role*).
 *
 *     const { gate } = useAccess();
 *     const build = gate("build");
 *     <ActButton area="build">New agent</ActButton>      // a button
 *     headerActions={[gateItem(newAgent, build)]}         // a panel header icon
 *
 * Off a Graph, and until `…/access` loads, every area is open: the engine
 * re-checks each write and its refusal names the role and who holds it.
 */
export function useAccess() {
	const graph = useOpenGraph();
	const { user } = useAuth();
	const access = useGraphAccessQuery(graph);
	const gate = useCallback(
		(area: AccessAreaName): Gate => gateOf(access.data, area, user?.username),
		[access.data, user?.username],
	);
	return { gate, loading: access.isLoading };
}

/**
 * A panel header action as the gate allows it: unchanged when allowed;
 * otherwise disabled, its tooltip the reason. Its `name` stays the act's, so
 * it is still found by what it does.
 */
export function gateItem<T extends NavHorizontalItem>(item: T, gate: Gate): T {
	if (gate.allowed) return item;
	return {
		...item,
		disabled: true,
		tooltip: `${item.name} · ${gate.reason}`,
		// Kept as a no-op: an item with no handler is drawn as static text, not a button.
		onClick: () => {},
	};
}
