import { useSetupSectionMutation } from "@/hooks/queries/useGraphs";
import { formatRelativeTime } from "@/lib/time";
import { SetupMarker } from "@/pages/graphs-detail/features/setup/SetupMarker";
import {
	SETUP_STEPS,
	SETUP_STEP_BY_KEY,
	type SetupStepMeta,
} from "@/pages/graphs-detail/features/setup/setupSteps";
import { useSettingsPanel } from "@/pages/graphs-detail/shell/useSettingsPanel";
import {
	type Graph,
	SETUP_REQUIRED,
	SETUP_SKIPPABLE,
	type SetupSection,
	type SetupSectionState,
	setupSectionStatus,
} from "@/types/graphs";
import { Button, SectionHeader, TimelineEntry, TimelineList } from "@invana/ui";
import { ArrowRight } from "lucide-react";
import { toast } from "sonner";

interface Props {
	graph: Graph;
}

/**
 * Setup, as the sequence it actually is (graph-detail-page.md G21 · G27).
 *
 * The compact half of the pair: the board on the graph page is where a step is
 * done, this is where it is remembered. Both read `setupSteps.ts`, so the
 * sequence cannot say two different things in two places.
 *
 * It draws what the engine **derived** — a step is done when the thing it asks
 * for exists (setup.md SU1), so importing data ticks "Bring data in" without
 * anyone telling setup. That is the whole reason this replaced a checklist: the
 * old one could be honestly finished and still read as untouched.
 *
 * A rail rather than a two-column log, because the panel is 420px and a step's
 * title wraps; `when` carries the moment the fact came into being where the
 * schema records one, and the step's standing where it does not.
 *
 * The card is not rendered at all once the required steps are done — see
 * `GraphInfoPanel`. A finished checklist is the one kind worth removing.
 */
export function SetupTimeline({ graph }: Props) {
	const setupMutation = useSetupSectionMutation();
	const { setSection } = useSettingsPanel();

	const done = SETUP_REQUIRED.filter(
		(s) => setupSectionStatus(graph.setup_state?.[s]) !== "todo",
	).length;

	// The first step still to do is the one the user is being asked for now;
	// everything after it waits its turn. Only one step is ever "next", and a
	// blocked one is never it (SU12).
	const nextKey = SETUP_STEPS.find(
		(s) =>
			setupSectionStatus(graph.setup_state?.[s.key]) === "todo" &&
			!graph.setup_state?.[s.key]?.blocked_by,
	)?.key;

	const act = (section: SetupSection, action: "skip" | "reset") => {
		setupMutation.mutate(
			{
				username: graph.owner_username,
				graphSlug: graph.slug,
				section,
				action,
			},
			{ onError: (err) => toast.error(err.message) },
		);
	};

	return (
		<section className="rounded-control border border-border">
			<SectionHeader
				title="Setup"
				count={`${done} / ${SETUP_REQUIRED.length}`}
				className="px-3"
			/>
			<p className="px-3 pt-2.5 text-muted-foreground">
				{`${SETUP_REQUIRED.length} required steps take this graph from connected to answering. The rest are optional.`}
			</p>
			<TimelineList variant="rail" className="px-3 py-3">
				{SETUP_STEPS.map((meta) => (
					<SetupStep
						key={meta.key}
						meta={meta}
						state={graph.setup_state?.[meta.key]}
						isNext={meta.key === nextKey}
						onOpen={() => setSection(meta.settingsSection, meta.settingsTab)}
						onSkip={() => act(meta.key, "skip")}
						onUndoSkip={() => act(meta.key, "reset")}
					/>
				))}
			</TimelineList>
		</section>
	);
}

function SetupStep({
	meta,
	state,
	isNext,
	onOpen,
	onSkip,
	onUndoSkip,
}: {
	meta: SetupStepMeta;
	state: SetupSectionState | undefined;
	isNext: boolean;
	onOpen: () => void;
	onSkip: () => void;
	onUndoSkip: () => void;
}) {
	const status = setupSectionStatus(state);
	const optional = SETUP_SKIPPABLE.includes(meta.key);

	// `when` is the step's place in time where the engine knows it, and its
	// standing where it does not — a step that has not happened has no moment to
	// name, and "—" would say less than "next".
	const when =
		status === "done"
			? state?.completed_at
				? formatRelativeTime(new Date(state.completed_at))
				: "done"
			: status === "broken"
				? "broken"
				: status === "skipped"
					? "skipped"
					: status === "blocked"
						? "waiting"
						: isNext
							? "next"
							: optional
								? "optional"
								: "required";

	return (
		<TimelineEntry
			when={when}
			marker={<SetupMarker status={status} isNext={isNext} />}
			title={
				<span
					className={status === "todo" ? undefined : "text-muted-foreground"}
				>
					{meta.label}
				</span>
			}
		>
			{status === "broken" && state?.broken && (
				<p className="text-muted-foreground">{state.broken}</p>
			)}
			{status === "blocked" && state?.blocked_by && (
				<p className="text-muted-foreground">
					{`Waiting on ${SETUP_STEP_BY_KEY[state.blocked_by].label.toLowerCase()}.`}
				</p>
			)}
			{status === "todo" && (
				<p className="text-muted-foreground">{meta.description}</p>
			)}
			<div className="flex items-center gap-1 pt-0.5">
				{status !== "done" && status !== "blocked" && (
					<Button
						variant="link"
						size="sm"
						className="h-auto p-0"
						onClick={onOpen}
					>
						{status === "skipped"
							? "Set it up anyway"
							: status === "broken"
								? "Fix it"
								: "Set up"}
						<ArrowRight className="size-3.5" />
					</Button>
				)}
				{status === "todo" && optional && (
					<Button
						variant="link"
						size="sm"
						className="h-auto p-0 text-muted-foreground"
						onClick={onSkip}
					>
						Skip
					</Button>
				)}
				{status === "skipped" && (
					<Button
						variant="link"
						size="sm"
						className="h-auto p-0 text-muted-foreground"
						onClick={onUndoSkip}
					>
						Undo skip
					</Button>
				)}
				{status === "done" && (
					<Button
						variant="link"
						size="sm"
						className="h-auto p-0 text-muted-foreground"
						onClick={onOpen}
					>
						Review
						<ArrowRight className="size-3.5" />
					</Button>
				)}
			</div>
		</TimelineEntry>
	);
}
