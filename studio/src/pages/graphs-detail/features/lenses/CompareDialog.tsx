/**
 * Picking the second run — the way into R3.
 *
 * *As someone who re-asked a question in a different world, I want to put the
 * two runs beside each other, so that the difference in the answers has a
 * reason I can read.*
 *
 * **Compare is two runs, not a diff engine**
 * ([WO4](../../../../../docs/for-developers/modules/govern/features/worlds.md)),
 * so this picks a run that already happened. There is nothing to configure and
 * nothing to launch: a comparison of two runs that do not exist would have to
 * invent one of them.
 *
 * **Runs that asked the same thing come first, and say so.** The pairing the
 * design is about is *one question, two worlds* — a list in plain recency order
 * buries it under whatever else the Graph has been doing this afternoon. The
 * rest are still offered, because comparing two different questions is a
 * legitimate thing to want and refusing it would be a rule nobody asked for.
 */

import { useRunsJournalQuery } from "@/hooks/queries/useRuns";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	Eyebrow,
	Item,
	ItemContent,
	ItemDescription,
	ItemTitle,
	Spinner,
	StatusDot,
} from "@invana/ui";
import { useMemo } from "react";

export interface CompareDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	username?: string;
	graphSlug?: string;
	/** The run already on screen — it is one half, and never offered as the other. */
	runId: string;
	/** What this run asked, so the same question sorts to the top. */
	question?: string | null;
	onPick: (otherRunId: string) => void;
}

export function CompareDialog({
	open,
	onOpenChange,
	username,
	graphSlug,
	runId,
	question,
	onPick,
}: CompareDialogProps) {
	const journal = useRunsJournalQuery(username, graphSlug);

	const { sameQuestion, others } = useMemo(() => {
		const rows = journal.rows.filter((r) => r.id !== runId);
		// Compare like with like: the journal derives a row's title from the ask
		// (`askTitle`), so matching the raw `body` against those titles never
		// groups anything. This run's **own row** is the thing to match on, and
		// the body is only the fallback for a run the journal has not loaded.
		const mine = journal.rows.find((r) => r.id === runId);
		const asked = (mine?.title ?? question ?? "").trim();
		return {
			sameQuestion: asked ? rows.filter((r) => r.title.trim() === asked) : [],
			others: asked ? rows.filter((r) => r.title.trim() !== asked) : rows,
		};
	}, [journal.rows, runId, question]);

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-h-[70vh] overflow-y-auto">
				<DialogHeader>
					<DialogTitle>Compare this run with…</DialogTitle>
					<DialogDescription>
						Both runs happened for real, under their own worlds. What the second
						one touched that the first did not is the part you cannot
						reconstruct by reading both answers.
					</DialogDescription>
				</DialogHeader>

				{journal.isLoading ? (
					<div className="flex items-center gap-2 py-2 text-sm text-muted-foreground">
						<Spinner className="size-3" /> reading this Graph's runs
					</div>
				) : null}

				{sameQuestion.length ? (
					<>
						<Eyebrow>The same question, run again</Eyebrow>
						{sameQuestion.map((row) => (
							<RunOption key={row.id} row={row} onPick={onPick} />
						))}
					</>
				) : null}

				{others.length ? (
					<>
						<Eyebrow>Every other run</Eyebrow>
						{others.map((row) => (
							<RunOption key={row.id} row={row} onPick={onPick} />
						))}
					</>
				) : null}

				{!journal.isLoading && !sameQuestion.length && !others.length ? (
					// A sentence, not an empty list — and it names what would fix it.
					<p className="py-2 text-sm text-muted-foreground">
						This Graph has only run once. Ask the same question under another
						world, and the two will be here to put side by side.
					</p>
				) : null}
			</DialogContent>
		</Dialog>
	);
}

function RunOption({
	row,
	onPick,
}: {
	row: { id: string; title: string; status: string; startedAt: string | null };
	onPick: (runId: string) => void;
}) {
	return (
		<Item asChild>
			<button
				type="button"
				className="w-full text-left"
				onClick={() => onPick(row.id)}
			>
				<StatusDot />
				<ItemContent>
					<ItemTitle>{row.title}</ItemTitle>
					<ItemDescription>
						{row.status}
						{row.startedAt
							? ` · ${new Date(row.startedAt).toLocaleString()}`
							: ""}
					</ItemDescription>
				</ItemContent>
			</button>
		</Item>
	);
}
