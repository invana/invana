import { SetupBoard } from "@/pages/graphs-detail/features/setup/SetupBoard";
import { SetupLesson } from "@/pages/graphs-detail/features/setup/SetupLesson";
import { SetupStepper } from "@/pages/graphs-detail/features/setup/SetupStepper";
import { WhatNextPane } from "@/pages/graphs-detail/features/setup/WhatNextPane";
import { useOnboarding } from "@/pages/graphs-detail/features/setup/useOnboarding";
import {
	WHAT_NEXT_KEY,
	useSetupStep,
} from "@/pages/graphs-detail/features/setup/useSetupStep";
import {
	type Graph,
	SETUP_REQUIRED,
	SETUP_SKIPPABLE,
	isGateOpen,
	isSetupComplete,
	setupSectionStatus,
} from "@/types/graphs";
import { Button, Progress } from "@invana/ui";
import { X } from "lucide-react";

/**
 * The onboarding wizard — the surface that walks Setup
 * (docs/for-developers/modules/platform/features/setup.md §7).
 *
 * An **island**: one card centred on the board, with the board visible around
 * it (SU16). The margin is what says the graph page is still underneath — a
 * region filled edge to edge would read as a takeover, and this is not a modal
 * (SU7). Inside it, the stepper says what is left and the lesson teaches the
 * step you are on; below 640px of island the two stack into the gate-card
 * board, which is the same rows in one column.
 *
 * It invents nothing. Done, required, blocked and broken are read off what the
 * engine derived (SU1), so a step finished at a terminal or by another member
 * is finished here without being told.
 */
export function OnboardingWizard({
	graph,
	username,
	graphSlug,
}: {
	graph: Graph;
	username: string;
	graphSlug: string;
}) {
	const { step, select, next, previous, isFirst, isLast } = useSetupStep(graph);
	const { isOpen, close } = useOnboarding();

	const doneRequired = SETUP_REQUIRED.filter(
		(s) => graph.setup_state?.[s]?.done,
	).length;

	// Only one step is ever "next": the first required one still to do, and the
	// first optional one only once the required set is closed. A blocked step is
	// never it (SU12).
	const ready = isSetupComplete(graph);
	const outstanding = (s: (typeof SETUP_REQUIRED)[number]) =>
		setupSectionStatus(graph.setup_state?.[s]) === "todo" &&
		!graph.setup_state?.[s]?.blocked_by;
	const nextKey =
		SETUP_REQUIRED.find(outstanding) ??
		(ready ? SETUP_SKIPPABLE.find(outstanding) : undefined);

	return (
		<div className="flex h-full w-full items-center justify-center overflow-auto bg-background p-6">
			<div className="@container flex h-full max-h-[720px] w-full max-w-[1060px] flex-col overflow-hidden rounded-control border border-border bg-card shadow-lg">
				{/* ── Where this graph stands ──────────────────────────────────── */}
				<header className="flex shrink-0 flex-col gap-2 border-border border-b px-6 py-4">
					<div className="flex items-baseline justify-between gap-4">
						<h1 className="truncate font-semibold text-lg">{graph.name}</h1>
						<div className="flex shrink-0 items-center gap-2">
							<p className="whitespace-nowrap text-meta text-muted-foreground">
								{doneRequired} of {SETUP_REQUIRED.length} required steps
							</p>
							{/* A ready Graph shows the identity card, not the wizard (G26),
							    so one opened from the cap needs a way back. While a step is
							    still outstanding there is nothing to close *to*: the wizard
							    is the page. */}
							{ready && isOpen && (
								<Button
									variant="ghost"
									size="icon"
									aria-label="Close onboarding"
									className="size-6"
									onClick={close}
								>
									<X className="size-3.5" />
								</Button>
							)}
						</div>
					</div>
					<div className="flex items-center gap-3">
						<Progress
							value={(doneRequired / SETUP_REQUIRED.length) * 100}
							className="w-[240px] shrink-0"
						/>
						<p className="min-w-0 truncate text-muted-foreground">
							{standing(graph)}
						</p>
					</div>
				</header>

				{/* ── Wide: the stepper and the lesson ─────────────────────────── */}
				{/* Both branches take their `display` from a container query and
				    neither carries a base one. A plain `hidden` here would be emitted
				    after the `@container` block and win over the min-width rule, which
				    blanks the island: the two queries are mutually exclusive, so
				    nothing can out-order them. The widths are px because the root font
				    dial is 13px — `@3xl` would stack ~150px earlier than it reads. */}
				<div className="min-h-0 flex-1 @max-[640px]:hidden @min-[640px]:flex">
					<SetupStepper
						graph={graph}
						selected={step}
						onSelect={select}
						nextKey={nextKey}
					/>
					{step === WHAT_NEXT_KEY ? (
						<WhatNextPane graph={graph} />
					) : (
						<SetupLesson
							graph={graph}
							section={step}
							username={username}
							graphSlug={graphSlug}
							isFirst={isFirst}
							isLast={isLast}
							onPrevious={previous}
							onNext={next}
						/>
					)}
				</div>

				{/* ── Narrow: the same rows, stacked ──────────────────────────── */}
				<div className="min-h-0 flex-1 @max-[640px]:block @min-[640px]:hidden">
					<SetupBoard
						graph={graph}
						username={username}
						graphSlug={graphSlug}
						variant="stacked"
					/>
				</div>
			</div>
		</div>
	);
}

/** One sentence on what this graph can and cannot do right now. Composed from
 *  the gates rather than from a step count, because "2 of 4" says nothing about
 *  which two. */
function standing(graph: Graph): string {
	const connected = isGateOpen(graph, "connected");
	const grounded = isGateOpen(graph, "grounded");
	const answering = isGateOpen(graph, "answering");
	if (!connected) return "Nothing is connected yet.";
	if (grounded && answering) return "Ready — ask it something.";
	if (grounded)
		return "This graph can be explored and queried. It cannot answer questions yet.";
	if (answering) return "It can answer, but it has nothing to answer from yet.";
	return "This graph can be explored and queried. It has nothing to answer from, and nothing to answer with.";
}
