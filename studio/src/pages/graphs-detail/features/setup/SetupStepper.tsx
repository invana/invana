import { SetupMarker } from "@/pages/graphs-detail/features/setup/SetupMarker";
import {
	SETUP_GATE_META,
	SETUP_STEPS,
} from "@/pages/graphs-detail/features/setup/setupSteps";
import {
	type SetupStepKey,
	WHAT_NEXT_KEY,
} from "@/pages/graphs-detail/features/setup/useSetupStep";
import {
	type Graph,
	SETUP_SKIPPABLE,
	type SetupSection,
	setupSectionStatus,
} from "@/types/graphs";
import { Eyebrow, cn } from "@invana/ui";

/**
 * The wizard's left rail: every step, grouped by the gate it opens, with the
 * selected one marked (setup.md 7.3).
 *
 * It shows **what is left** while the lesson beside it teaches **the step you
 * are on** — that pairing is the whole reason the wizard has two panes. Every
 * row stays selectable in any order, so this is navigation and not a sequence
 * being enforced (SU16).
 *
 * It renders no actions: skipping, opening and undoing all live in the lesson,
 * because a rail that both navigates and acts makes one click mean two things.
 */
export function SetupStepper({
	graph,
	selected,
	onSelect,
	nextKey,
}: {
	graph: Graph;
	selected: SetupStepKey;
	onSelect: (key: SetupStepKey) => void;
	nextKey: SetupSection | undefined;
}) {
	const optional = SETUP_STEPS.filter((m) => SETUP_SKIPPABLE.includes(m.key));

	return (
		<nav
			aria-label="Setup steps"
			className="flex w-[248px] shrink-0 flex-col overflow-y-auto border-border border-r px-3 pb-4"
		>
			{SETUP_GATE_META.map((gate) => {
				const steps = SETUP_STEPS.filter(
					(m) => graph.setup_state?.[m.key]?.gate === gate.gate,
				);
				if (steps.length === 0) return null;
				return (
					<div key={gate.gate} className="flex flex-col">
						<Eyebrow className="px-1.5 pt-3 pb-1.5">
							{gate.ordinal} · {gate.title}
						</Eyebrow>
						{steps.map((meta) => (
							<StepRow
								key={meta.key}
								graph={graph}
								section={meta.key}
								label={meta.label}
								selected={meta.key === selected}
								isNext={meta.key === nextKey}
								onSelect={onSelect}
							/>
						))}
					</div>
				);
			})}

			<Eyebrow className="px-1.5 pt-3 pb-1.5">Optional</Eyebrow>
			{optional.map((meta) => (
				<StepRow
					key={meta.key}
					graph={graph}
					section={meta.key}
					label={meta.label}
					selected={meta.key === selected}
					isNext={meta.key === nextKey}
					onSelect={onSelect}
				/>
			))}

			<Eyebrow className="px-1.5 pt-3 pb-1.5">After setup</Eyebrow>
			<button
				type="button"
				aria-current={selected === WHAT_NEXT_KEY ? "step" : undefined}
				onClick={() => onSelect(WHAT_NEXT_KEY)}
				className={cn(
					"flex items-center gap-2 rounded-control px-1.5 py-1.5 text-left",
					"hover:bg-accent",
					selected === WHAT_NEXT_KEY &&
						"bg-accent font-semibold shadow-[inset_2px_0_0_0_var(--primary)]",
				)}
			>
				{/* No dot. It is not a step and nothing about it is owed (SU4), and a
				    dot is the thing that would say otherwise. */}
				<span className="size-3.5 shrink-0" />
				<span className="min-w-0 truncate">What next</span>
			</button>
		</nav>
	);
}

function StepRow({
	graph,
	section,
	label,
	selected,
	isNext,
	onSelect,
}: {
	graph: Graph;
	section: SetupSection;
	label: string;
	selected: boolean;
	isNext: boolean;
	onSelect: (key: SetupStepKey) => void;
}) {
	const status = setupSectionStatus(graph.setup_state?.[section]);
	return (
		<button
			type="button"
			aria-current={selected ? "step" : undefined}
			onClick={() => onSelect(section)}
			className={cn(
				"flex items-center gap-2 rounded-control px-1.5 py-1.5 text-left",
				"hover:bg-accent",
				selected &&
					"bg-accent font-semibold shadow-[inset_2px_0_0_0_var(--primary)]",
			)}
		>
			<SetupMarker status={status} isNext={isNext} />
			<span
				className={cn(
					"min-w-0 truncate",
					!selected && status === "done" && "text-muted-foreground",
				)}
			>
				{label}
			</span>
			{isNext && !selected && (
				<span className="ml-auto shrink-0 text-sm text-primary">next</span>
			)}
		</button>
	);
}
