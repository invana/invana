/**
 * The rows a Govern drawer is made of, and the three states it owes besides
 * them: loading, failed, and nothing set.
 *
 * Both drawers list the same record — a guardrail and a world are one row
 * separated by `kind` (GV1) — so they list it the same way. What differs is the
 * sentence each shows when the list is empty, which is why that is a prop: *no
 * guardrails* and *no worlds* are different facts about a Graph, and neither is
 * an empty table ([GR6](../../../../docs/for-developers/modules/govern/features/guardrails.md)).
 */

import {
	narrowingsOf,
	since,
} from "@/pages/graphs-detail/features/govern/narrowing";
import type { Lens } from "@/types/govern";
import { EmptyState, LensRow, Spinner } from "@invana/ui";

export interface LensListProps {
	items: Lens[];
	isLoading: boolean;
	error: unknown;
	selectedId: string | null;
	onSelect: (id: string) => void;
	/** What the drawer says when the Graph has none of these. A sentence. */
	emptyLine: string;
	/** What a failure says. The message beneath it is the error's own. */
	errorTitle: string;
	/** The word for one of these, used in the loading line. */
	loadingLine: string;
}

export function LensList({
	items,
	isLoading,
	error,
	selectedId,
	onSelect,
	emptyLine,
	errorTitle,
	loadingLine,
}: LensListProps) {
	if (isLoading) {
		return (
			<div className="flex items-center gap-2 p-3 text-sm text-muted-foreground">
				<Spinner className="size-3" />
				{loadingLine}
			</div>
		);
	}

	if (error) {
		return (
			<EmptyState
				title={errorTitle}
				description={
					error instanceof Error ? error.message : "The request failed."
				}
			/>
		);
	}

	// A sentence, never an empty table (GR6). An empty table says *the columns
	// are here and the rows are missing*; what is true is that nobody has set
	// one, and what that means for a run is the half worth printing.
	if (!items.length) {
		return (
			<p className="px-3 py-2 text-sm text-muted-foreground">{emptyLine}</p>
		);
	}

	return (
		<div className="flex min-w-0 flex-col">
			{items.map((lens) => (
				<LensRow
					key={lens.id}
					name={lens.display_name}
					narrows={narrowingsOf(lens)}
					usage={
						lens.usage
							? {
									runs: lens.usage.runs,
									lastUsed: since(lens.usage.last_used_at),
								}
							: undefined
					}
					selected={selectedId === lens.id}
					onSelect={() => onSelect(lens.id)}
				/>
			))}
		</div>
	);
}
