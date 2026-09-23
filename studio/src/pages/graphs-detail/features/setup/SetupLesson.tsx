import { useSetupSectionMutation } from "@/hooks/queries/useGraphs";
import {
	SETUP_GATE_META,
	SETUP_STEP_BY_KEY,
	setupCommand,
} from "@/pages/graphs-detail/features/setup/setupSteps";
import { useSettingsPanel } from "@/pages/graphs-detail/shell/useSettingsPanel";
import {
	type Graph,
	SETUP_REQUIRED,
	SETUP_SKIPPABLE,
	type SetupSection,
	setupSectionStatus,
} from "@/types/graphs";
import {
	Button,
	ButtonGroup,
	Eyebrow,
	Terminal,
	TerminalLine,
} from "@invana/ui";
import { ArrowLeft, ArrowRight, Copy, Sparkles } from "lucide-react";
import { toast } from "sonner";

/**
 * One step, taught (setup.md 7.1 · 7.2).
 *
 * Why it matters, the concept it depends on, how to do it, the terminal line
 * that does the same thing, and the fact that proves it landed. Six fields, the
 * same six on every step, so a step's teaching cannot say one thing here and
 * another in the docs.
 *
 * It owns **no form** (SU2): the primary action opens the panel that already
 * holds the field. And it never claims a step is done — that is derived (SU1),
 * which is why the closing band says what to *look at* rather than offering an
 * "I've done it" button.
 */
export function SetupLesson({
	graph,
	section,
	username,
	graphSlug,
	isFirst,
	isLast,
	onPrevious,
	onNext,
}: {
	graph: Graph;
	section: SetupSection;
	username: string;
	graphSlug: string;
	isFirst: boolean;
	isLast: boolean;
	onPrevious: () => void;
	onNext: () => void;
}) {
	const meta = SETUP_STEP_BY_KEY[section];
	const state = graph.setup_state?.[section];
	const status = setupSectionStatus(state);
	const optional = SETUP_SKIPPABLE.includes(section);
	const gate = SETUP_GATE_META.find((g) => g.gate === state?.gate);
	const command = setupCommand(meta, username, graphSlug);

	// "step 3 of 4" counts the **required** steps, never all six (SU15). An
	// optional step is not the nth of anything — it says so instead.
	const requiredIndex = SETUP_REQUIRED.indexOf(section);
	const position =
		requiredIndex >= 0
			? `step ${requiredIndex + 1} of ${SETUP_REQUIRED.length}`
			: "optional";

	const { setSection } = useSettingsPanel();
	const setupMutation = useSetupSectionMutation();
	const act = (action: "skip" | "reset") =>
		setupMutation.mutate(
			{ username, graphSlug, section, action },
			{ onError: (err) => toast.error(err.message) },
		);

	const blockedBy = state?.blocked_by
		? SETUP_STEP_BY_KEY[state.blocked_by]
		: undefined;

	// `@container` on the root is load-bearing: the width queries inside this
	// pane have to measure *the pane*, not the island. Without it they read the
	// island — 248px of stepper wider — and the Why/How split fired at a pane
	// still under 450px, which is what squeezed "Why it matters" down to three
	// words a line whenever a side panel was open.
	return (
		<div className="@container flex min-w-0 flex-1 flex-col gap-4 overflow-y-auto px-6 pb-5">
			{/* ── Which step, and what it opens ──────────────────────────────── */}
			<header className="flex items-start justify-between gap-4 pt-4">
				<div className="flex min-w-0 flex-col gap-1">
					<Eyebrow>
						{gate ? `Gate ${gate.ordinal} · ${gate.title}` : "Optional"}
					</Eyebrow>
					<h2 className="truncate font-semibold text-lg">{meta.label}</h2>
					<p className="text-muted-foreground">
						{gate ? `Unlocks ${gate.unlocks}.` : "It never holds a gate shut."}
					</p>
				</div>
				<p className="shrink-0 whitespace-nowrap text-sm text-muted-foreground">
					{position}
				</p>
			</header>

			{/* ── The product lesson (SU17) ──────────────────────────────────── */}
			{meta.concept && (
				<aside className="flex gap-2.5 rounded-control border border-info/30 bg-info/5 p-3">
					<Sparkles className="mt-0.5 size-4 shrink-0 text-info" />
					<div className="flex min-w-0 flex-col gap-1">
						{/* A statement, not a label — so it is not an Eyebrow. Caps on a
						    full sentence reads as shouting, and the concept is the one
						    thing on the page that should read as someone talking. */}
						<p className="font-semibold text-info">{meta.concept.title}</p>
						<p>{meta.concept.body}</p>
					</div>
				</aside>
			)}

			{/* ── Broken and blocked speak first, in the engine's words ──────── */}
			{state?.broken && (
				<p className="rounded-control border border-destructive/30 bg-destructive/5 p-3 text-destructive">
					{state.broken}
				</p>
			)}
			{blockedBy && (
				<p className="rounded-control border border-border bg-muted p-3">
					Waiting on <span className="font-semibold">{blockedBy.label}</span>.
					Do that one first — this step needs what it publishes.
				</p>
			)}

			{/* ── Why · How on the left, what proves it on the right — but only
			     once *this pane* is past 600px, which it is only near the island's
			     full width. Below that, a 240px side column would leave the prose
			     under 340px, so the two stack instead. The threshold is in px, not
			     `@2xl`: the root font dial is 13px, so a rem breakpoint here reads
			     ~19% narrower than it looks. Neither direction carries a **base**
			     `flex-col` — the kit's stylesheet is concatenated after ours, so a
			     base utility re-declared there wins on source order and the column
			     rule could never fire. Both directions are variants. ───────── */}
			<div className="flex gap-6 @max-[600px]:flex-col @min-[600px]:flex-row">
				<div className="flex min-w-0 flex-1 flex-col gap-4">
					<section className="flex flex-col gap-1.5">
						<Eyebrow>Why it matters</Eyebrow>
						<p>{meta.why}</p>
					</section>

					<section className="flex flex-col gap-1.5">
						<Eyebrow>How</Eyebrow>
						<ol className="flex flex-col gap-1.5">
							{meta.how.map((move, i) => (
								<li key={move} className="flex gap-2">
									<span className="shrink-0 font-mono text-muted-foreground">
										{i + 1}
									</span>
									<span>{move}</span>
								</li>
							))}
						</ol>
					</section>
				</div>

				<section className="flex flex-col gap-1.5 @max-[600px]:w-full @min-[600px]:w-[240px] @min-[600px]:shrink-0">
					<Eyebrow>You'll know it worked</Eyebrow>
					<p className="text-muted-foreground">{meta.looksRight}</p>
				</section>
			</div>

			{/* ── The actions. The panel owns the form; this owns the door ───── */}
			<div className="flex flex-wrap items-center gap-2">
				<Button
					variant={status === "done" ? "outline" : "default"}
					size="sm"
					disabled={!!blockedBy}
					onClick={() =>
						blockedBy
							? undefined
							: setSection(meta.settingsSection, meta.settingsTab)
					}
				>
					<ArrowRight className="size-3.5" />
					{status === "done" || status === "broken"
						? "Review"
						: status === "skipped"
							? "Set it up anyway"
							: "Set up"}
				</Button>
				{blockedBy && (
					<Button
						variant="ghost"
						size="sm"
						onClick={() =>
							setSection(blockedBy.settingsSection, blockedBy.settingsTab)
						}
					>
						Open {blockedBy.label}
						<ArrowRight className="size-3.5" />
					</Button>
				)}
				{optional && status === "todo" && (
					<Button variant="ghost" size="sm" onClick={() => act("skip")}>
						Skip for now
					</Button>
				)}
				{status === "skipped" && (
					<Button variant="ghost" size="sm" onClick={() => act("reset")}>
						Undo skip
					</Button>
				)}
			</div>

			{/* ── The same thing, at a terminal (SU6) ────────────────────────── */}
			{command && (
				<section className="flex flex-col gap-1.5">
					<div className="flex items-center gap-2">
						<Eyebrow>From the terminal</Eyebrow>
						<Button
							variant="ghost"
							size="icon"
							aria-label="Copy command"
							className="ml-auto size-6"
							onClick={() => {
								void navigator.clipboard?.writeText(command);
								toast.success("Command copied");
							}}
						>
							<Copy className="size-3.5" />
						</Button>
					</div>
					<Terminal>
						<TerminalLine kind="prompt">{command}</TerminalLine>
					</Terminal>
				</section>
			)}

			<ButtonGroup className="mt-auto justify-end pt-2">
				<Button
					variant="ghost"
					size="sm"
					disabled={isFirst}
					onClick={onPrevious}
				>
					<ArrowLeft className="size-3.5" />
					Previous
				</Button>
				<Button variant="outline" size="sm" disabled={isLast} onClick={onNext}>
					Next step
					<ArrowRight className="size-3.5" />
				</Button>
			</ButtonGroup>
		</div>
	);
}
