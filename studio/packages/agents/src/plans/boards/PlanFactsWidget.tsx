/**
 * **The plan** — what the library knows about this entry, as a board panel:
 * where it came from, who owns it, the asks it matches and the agents that
 * may run it.
 *
 * *May run* is permission, not use: an agent is listed because it may call
 * the plan, whether or not it has. Each agent is a chip that dispatches
 * `openAgent` with its id, so the page opens it — a spec carries no callbacks.
 */

import type { PanelRendererProps } from "@invana/boards";
import { PropertyList, PropertyRow } from "@invana/ui";
import { PrincipalChip } from "@invana-studio/ui";

export interface PlanFactsOptions {
	origin: string;
	owner: string;
	/** The asks the plan matches, in the engine's order. */
	matches: string[];
	mayRun: { id: string; name: string }[];
	/** Dispatched with `{ itemId: <agent id> }` when a chip is pressed. */
	openAgent: string;
}

export function PlanFactsWidget({
	options,
	onAction,
}: PanelRendererProps<PlanFactsOptions>) {
	const { origin, owner, matches, mayRun, openAgent } = options;
	return (
		<PropertyList>
			<PropertyRow label="Origin">{origin}</PropertyRow>
			<PropertyRow label="Owner">{owner}</PropertyRow>
			<PropertyRow label="Matches">
				{matches.length ? matches.join(" · ") : "—"}
			</PropertyRow>
			<PropertyRow label="May run">
				{mayRun.length ? (
					<span className="flex flex-wrap gap-1">
						{mayRun.map((a) => (
							<PrincipalChip
								key={a.id}
								kind="agent"
								name={a.name}
								onClick={() => onAction(openAgent, { itemId: a.id })}
							/>
						))}
					</span>
				) : (
					"No agent may run it yet"
				)}
			</PropertyRow>
		</PropertyList>
	);
}
