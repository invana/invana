import { useSetupSectionMutation } from "@/hooks/queries/useGraphs";
import { SetupMarker } from "@/pages/graphs-detail/features/setup/SetupMarker";
import {
	SETUP_GATE_META,
	SETUP_STEPS,
	SETUP_STEP_BY_KEY,
	WHAT_NEXT,
	setupCommand,
} from "@/pages/graphs-detail/features/setup/setupSteps";
import { useSettingsPanel } from "@/pages/graphs-detail/shell/useSettingsPanel";
import {
	type Graph,
	SETUP_REQUIRED,
	SETUP_SKIPPABLE,
	type SetupSection,
	type SetupSectionState,
	isGateOpen,
	isSetupComplete,
	setupSectionStatus,
} from "@/types/graphs";
import {
	Button,
	Card,
	Item,
	ItemActions,
	ItemContent,
	ItemDescription,
	ItemGroup,
	ItemMedia,
	ItemTitle,
	Progress,
	SectionHeader,
	Terminal,
	TerminalLine,
} from "@invana/ui";
import { ArrowRight, Copy } from "lucide-react";
import { toast } from "sonner";

/**
 * Setup as one column — three gate cards, six step rows and the offers below
 * them (docs/for-developers/modules/platform/features/setup.md §5).
 *
 * This is what the onboarding wizard's island stacks into below 640px of its
 * own width, where a 248px stepper beside a lesson would leave neither enough
 * room. Same rows, same derivation, one column — `variant="stacked"` drops the standing header
 * and the outer frame, because the island already carries both. It owns **no
 * forms** (SU2): every action opens the panel that already holds that field,
 * with its tab named, so there is one form per fact in the whole product. And
 * it invents nothing — done, required, blocked and broken are all read off what
 * the engine derived (SU1), which is why a step finished at a terminal or by
 * another member is finished here without being told.
 *
 * The compact rendering of the same rows is `SetupTimeline`, in the Info panel.
 */
export function SetupBoard({
	graph,
	username,
	graphSlug,
	variant = "page",
}: {
	graph: Graph;
	username: string;
	graphSlug: string;
	/** `stacked` renders inside the wizard's island, which owns the heading. */
	variant?: "page" | "stacked";
}) {
	const stacked = variant === "stacked";
	const ready = isSetupComplete(graph);
	const doneRequired = SETUP_REQUIRED.filter(
		(s) => graph.setup_state?.[s]?.done,
	).length;

	// Only one step is ever "next": the first required one still to do, and the
	// first optional one only once the required set is closed.
	const nextKey =
		SETUP_REQUIRED.find(
			(s) =>
				setupSectionStatus(graph.setup_state?.[s]) === "todo" &&
				!graph.setup_state?.[s]?.blocked_by,
		) ??
		(ready
			? SETUP_SKIPPABLE.find(
					(s) => setupSectionStatus(graph.setup_state?.[s]) === "todo",
				)
			: undefined);

	const optional = SETUP_STEPS.filter((m) => SETUP_SKIPPABLE.includes(m.key));
	const outstandingOptional = optional.filter(
		(m) => setupSectionStatus(graph.setup_state?.[m.key]) === "todo",
	).length;

	return (
		<div className="h-full w-full overflow-auto p-4">
			<div
				className={
					stacked
						? "flex w-full flex-col gap-4"
						: "mx-auto flex w-full max-w-2xl flex-col gap-5"
				}
			>
				{/* ── Where this graph stands. The island says it instead when the
				     wizard is what mounted this. ─────────────────────────────── */}
				{!stacked && (
					<header className="flex flex-col gap-2">
						<h1 className="truncate font-semibold text-lg">{graph.name}</h1>
						<Progress value={(doneRequired / SETUP_REQUIRED.length) * 100} />
						<p className="text-muted-foreground">
							<span className="text-foreground">
								{doneRequired} of {SETUP_REQUIRED.length}
							</span>{" "}
							· {standing(graph)}
						</p>
					</header>
				)}

				{/* ── The three gates ──────────────────────────────────────────── */}
				{SETUP_GATE_META.map((gate) => (
					<Card key={gate.gate} className="overflow-hidden">
						<SectionHeader
							title={gate.title}
							count={isGateOpen(graph, gate.gate) ? "open" : "shut"}
							className="px-4"
						/>
						<p className="px-4 pt-2 text-muted-foreground">
							Unlocks {gate.unlocks}.
						</p>
						<ItemGroup className="p-2">
							{SETUP_STEPS.filter(
								(m) => graph.setup_state?.[m.key]?.gate === gate.gate,
							).map((meta) => (
								<SetupRow
									key={meta.key}
									section={meta.key}
									graph={graph}
									username={username}
									graphSlug={graphSlug}
									isNext={meta.key === nextKey}
								/>
							))}
						</ItemGroup>
					</Card>
				))}

				{/* ── The optional two ─────────────────────────────────────────── */}
				<Card className="overflow-hidden">
					<SectionHeader
						title="Optional"
						count={
							outstandingOptional === 0 ? "none left" : `${outstandingOptional}`
						}
						className="px-4"
					/>
					<p className="px-4 pt-2 text-muted-foreground">
						Neither holds a gate shut. Instructions are worth writing once there
						is a model and a provider for them to instruct.
					</p>
					<ItemGroup className="p-2">
						{optional.map((meta) => (
							<SetupRow
								key={meta.key}
								section={meta.key}
								graph={graph}
								username={username}
								graphSlug={graphSlug}
								isNext={meta.key === nextKey}
							/>
						))}
					</ItemGroup>
				</Card>

				{/* ── What next — offers, never steps (SU4) ────────────────────── */}
				{ready && (
					<Card className="overflow-hidden">
						<SectionHeader title="What next" className="px-4" />
						<ItemGroup className="p-2">
							{WHAT_NEXT.map((offer) => (
								<WhatNextRow key={offer.label} offer={offer} />
							))}
						</ItemGroup>
					</Card>
				)}
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
	if (!connected) return "nothing is connected yet";
	if (grounded && answering) return "ready — ask it something";
	if (grounded)
		return "explorable and queryable; it cannot answer questions yet";
	if (answering) return "it can answer, but has nothing to answer from yet";
	return "explorable and queryable; it has nothing to answer from, and nothing to answer with";
}

function SetupRow({
	section,
	graph,
	username,
	graphSlug,
	isNext,
}: {
	section: SetupSection;
	graph: Graph;
	username: string;
	graphSlug: string;
	isNext: boolean;
}) {
	const meta = SETUP_STEP_BY_KEY[section];
	const state = graph.setup_state?.[section];
	const status = setupSectionStatus(state);
	const optional = SETUP_SKIPPABLE.includes(section);
	const { setSection } = useSettingsPanel();
	const setupMutation = useSetupSectionMutation();
	const command = setupCommand(meta, username, graphSlug);

	const act = (action: "skip" | "reset") =>
		setupMutation.mutate(
			{ username, graphSlug, section, action },
			{ onError: (err) => toast.error(err.message) },
		);

	const open = () => setSection(meta.settingsSection, meta.settingsTab);

	return (
		<Item variant="muted" className="items-start">
			<ItemMedia className="pt-1">
				<SetupMarker status={status} isNext={isNext} />
			</ItemMedia>
			<ItemContent>
				<ItemTitle className={status === "done" ? "text-muted-foreground" : ""}>
					{meta.label}
				</ItemTitle>
				<ItemDescription>{describe(meta.description, state)}</ItemDescription>
				{command && status !== "done" && (
					<div className="pt-2">
						<Terminal>
							<TerminalLine kind="prompt">{command}</TerminalLine>
						</Terminal>
						<Button
							variant="link"
							size="sm"
							className="h-auto p-0 text-muted-foreground"
							onClick={() => {
								void navigator.clipboard?.writeText(command);
								toast.success("Command copied");
							}}
						>
							<Copy className="size-3.5" />
							Copy
						</Button>
					</div>
				)}
			</ItemContent>
			<ItemActions>
				{status === "blocked" ? (
					<Button variant="ghost" size="sm" onClick={open} disabled>
						Waiting
					</Button>
				) : (
					<Button
						variant={isNext ? "default" : "ghost"}
						size="sm"
						onClick={open}
					>
						{status === "done" || status === "broken"
							? "Review"
							: status === "skipped"
								? "Set it up anyway"
								: "Set up"}
						<ArrowRight className="size-3.5" />
					</Button>
				)}
				{status === "todo" && optional && (
					<Button
						variant="link"
						size="sm"
						className="h-auto p-0 text-muted-foreground"
						onClick={() => act("skip")}
					>
						Skip
					</Button>
				)}
				{status === "skipped" && (
					<Button
						variant="link"
						size="sm"
						className="h-auto p-0 text-muted-foreground"
						onClick={() => act("reset")}
					>
						Undo skip
					</Button>
				)}
			</ItemActions>
		</Item>
	);
}

function WhatNextRow({
	offer,
}: {
	offer: (typeof WHAT_NEXT)[number];
}) {
	const { setSection } = useSettingsPanel();
	return (
		<Item variant="muted">
			<ItemContent>
				<ItemTitle>{offer.label}</ItemTitle>
				<ItemDescription>{offer.description}</ItemDescription>
			</ItemContent>
			<ItemActions>
				<Button
					variant="ghost"
					size="sm"
					onClick={() => setSection(offer.settingsSection)}
				>
					Open
					<ArrowRight className="size-3.5" />
				</Button>
			</ItemActions>
		</Item>
	);
}

/** What the row says under its title. A blocked or broken step says the reason
 *  the engine stored; everything else says what the step asks for. */
function describe(
	description: string,
	state: SetupSectionState | undefined,
): string {
	if (state?.broken) return state.broken;
	if (state?.blocked_by)
		return `Waiting on ${SETUP_STEP_BY_KEY[state.blocked_by].label.toLowerCase()}.`;
	return description;
}
