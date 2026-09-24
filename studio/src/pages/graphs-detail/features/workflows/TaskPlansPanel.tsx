/**
 * The workflow library (docs/for-developers/modules/agents/spec.md, journey J6).
 *
 * **Read-only, and it says so.** Authoring a workflow is out of MVP — a spec
 * drives dispatch, so authoring is an execution surface and needs its own
 * threat model. Nothing here offers an edit, and a canvas is not a loophole in
 * a threat model
 * (docs/for-developers/modules/explore/features/selection-and-the-panel.md).
 *
 * **The drawer's chrome is the drawer's** (G43). This body is the list, or —
 * drilled in — the one record, and nothing else: the header carries the trail,
 * the search, the filter and the acts, and the status bar belongs to the panel.
 *
 * The step detail is where the design earns itself. Every value is a statement,
 * not a disabled input — and a pin is drawn as a **count**, never as a claim,
 * because a pin lives on one agent's envelope while a library entry is used by
 * N (docs/for-developers/modules/explore/features/selection-and-the-panel.md). The `pinned by` row of agent chips is the precise answer, and
 * it is plural by construction (D3); there is no `Open envelope ›` link,
 * because "which of the N?" has no honest default (D4).
 */

import { useWorkflowQuery, useWorkflowsQuery } from "@/hooks/queries/useWork";
import { PromoteDialog } from "@/pages/graphs-detail/features/workflows/PromoteDialog";
import {
	AgentChipRow,
	DetailBlock,
	DetailProse,
	DetailStatus,
} from "@/pages/graphs-detail/shared/DetailRows";
import { WorkRow } from "@/pages/graphs-detail/shared/WorkRow";
import type { SkillLayer } from "@/types/skills";
import type {
	TaskPlanCaller,
	TaskPlanDagNode,
	TaskPlanDetail,
	TaskPlanLayer,
	TaskPlanSummary,
} from "@/types/work";
import { LAYER_PALETTE, layerSlug } from "@/ui/layerPalette";
import {
	Eyebrow,
	type Layer,
	type LayerBand,
	LayerChip,
	type LayerItem,
	LayerStrip,
	PropertyList,
	PropertyRow,
	RecordHeader,
	Spinner,
} from "@invana/ui";
import { Wand2 } from "lucide-react";
import type { ReactNode } from "react";

/** The reader's spelling back to the address segment the kit's components take.
 *
 * One substitution, not a second hand-written table: the engine sends
 * `graph data` because that is what a person reads, `LayerChip` takes
 * `graph_data` because that is what a rule matches on, and a table between them
 * is the drift that makes the two disagree. */
const slugOf = (layer: SkillLayer): Layer => layerSlug(layer);

/**
 * One band of the record: a label over its rows.
 *
 * **Not a `PanelBox`.** A band inside a scrolling panel carries a label, not a
 * border — four boxed cards in a 420px column read as four containers stacked
 * in a fifth, and the panel already has chrome of its own. `Eyebrow` is the
 * kit's smallest heading for exactly this, and several of them in one column
 * stay subordinate to the drawer's header the way the artboard draws them.
 */
function Band({
	title,
	aside,
	children,
}: {
	title: ReactNode;
	aside?: ReactNode;
	children: ReactNode;
}) {
	return (
		<section className="flex min-w-0 flex-col gap-1.5 px-3 pt-2.5 pb-1.5">
			<Eyebrow aside={aside}>{title}</Eyebrow>
			{children}
		</section>
	);
}

/** A plan's origin — what put it in the library (LB5).
 *
 * `generated` is not here: a one-off plan belongs to its Todo and is never
 * listed, so filtering by it would offer an always-empty list (LB6). */
export const PLAN_SOURCES = ["builtin", "authored", "promoted"] as const;

/** The intent family a plan's key names. */
export const PLAN_KINDS = ["nl", "ql"] as const;

interface Props {
	username: string;
	graphSlug: string;
	/** The drawer header's live search string (G33) — this body owns no chrome. */
	search: string;
	/** The drawer funnel's filters (G33). The body reads them, never owns them. */
	kindFilter: string;
	sourceFilter: string;
	selectedKey: string | null;
	onSelectKey: (key: string | null) => void;
	/** The step selected on the DAG — the panel's detail swaps to it (D1). */
	selectedStepId: string | null;
	/**
	 * Promoting is the list's one write, and its control is the drawer's header
	 * action — so the flag is the panel's, and this only draws the dialog (G43).
	 */
	promoting: boolean;
	onPromoting: (v: boolean) => void;
	/** The agent chips *are* the way out (D4). */
	onOpenAgent?: (agentId: string) => void;
	exportUrl?: (key: string) => string;
}

export function PlansDrawerBody({
	username,
	graphSlug,
	search,
	kindFilter,
	sourceFilter,
	selectedKey,
	onSelectKey,
	selectedStepId,
	promoting,
	onPromoting,
	onOpenAgent,
}: Props) {
	const list = useWorkflowsQuery(username, graphSlug);
	const detail = useWorkflowQuery(
		username,
		graphSlug,
		selectedKey ?? undefined,
	);

	const items = list.data?.items ?? [];
	const step = detail.data?.nodes.find((n) => n.id === selectedStepId) ?? null;

	// **Drilled in, the body is the record** (G43). The list is not drawn under
	// it, and neither is the list's footer: the drawer header already reads
	// `‹ PLANS / nl-single`, and repeating the nine rows beneath the one that was
	// asked for is what made the detail the last thing in a scrolling column.
	if (selectedKey) {
		if (!detail.data)
			return (
				<div className="px-3 py-4">
					<Spinner />
				</div>
			);
		return step ? (
			<StepDetail
				step={step}
				workflow={detail.data}
				onOpenAgent={onOpenAgent}
			/>
		) : (
			<TaskPlanDetailBlock workflow={detail.data} onOpenAgent={onOpenAgent} />
		);
	}

	return (
		<>
			{(() => {
				// The library is reusable plans only, and a reusable plan always has
				// a key — `key` is null exactly for the generated one-offs this
				// list never shows (LB6).
				const rows = items.filter(
					(w) =>
						(w.key ?? "").toLowerCase().includes(search.toLowerCase()) &&
						(!sourceFilter || w.origin === sourceFilter) &&
						// A workflow's kind is the intent family it matches — `nl-compare`
						// is an NL entry, `ql` a query-language one. It is derived from
						// the key rather than stored, because the key is the contract.
						(!kindFilter || (w.key ?? "").split("-")[0] === kindFilter),
				);
				return (
					<div className="flex h-full min-h-0 flex-col">
						<div className="flex-1 overflow-y-auto">
							{list.isLoading ? (
								<div className="px-3 py-4">
									<Spinner />
								</div>
							) : rows.length === 0 ? (
								<p className="px-3 py-4 text-base text-muted-foreground">
									{items.length
										? "No workflow matches those filters."
										: "No workflows in this graph yet."}
								</p>
							) : (
								rows.map((workflow) => (
									<WorkRow
										key={workflow.id}
										active={workflow.key === selectedKey}
										onClick={() =>
											onSelectKey(
												workflow.key === selectedKey ? null : workflow.key,
											)
										}
										// A candidate is a plan that served but nobody has
										// promoted; drawing it quiet keeps the library's own
										// entries the ones a reader reaches for first.
										tone={workflow.origin === "builtin" ? "info" : "muted"}
										title={
											<span className="font-mono">
												{workflow.key}@{workflow.version}
											</span>
										}
										// Only a non-seeded entry earns a badge: labelling every
										// row `seeded` would make the column noise.
										status={
											workflow.origin === "builtin"
												? undefined
												: workflow.origin
										}
										statusTone={
											workflow.origin === "promoted" ? "success" : "warning"
										}
										subtitle={<PlanRowLines workflow={workflow} />}
									/>
								))
							)}
						</div>
					</div>
				);
			})()}
			<PromoteDialog
				username={username}
				graphSlug={graphSlug}
				open={promoting}
				onOpenChange={onPromoting}
				// Land on what you just made: selecting it opens its detail and
				// draws its flow in one gesture (G42), so a promotion ends by
				// showing the thing it created.
				onPromoted={onSelectKey}
			/>
		</>
	);
}

function TaskPlanDetailBlock({
	workflow,
	onOpenAgent,
}: {
	workflow: TaskPlanDetail;
	onOpenAgent?: (id: string) => void;
}) {
	// A plan **is** its nodes, so what it is made of is a count of forms, not a
	// list: the flow on the canvas draws the steps, and repeating them here as
	// an ordered list was the panel saying the same thing twice in two shapes.
	const human = workflow.nodes.filter((n) => n.form === "human").length;
	const callables = workflow.nodes.length - human;

	return (
		// **No rules between the bands.** They are separated by air, the way the
		// artboard separates them: an `Eyebrow` is already a strong enough edge,
		// and a hairline under every band turns four labels into four boxes
		// without borders on three sides.
		<div className="flex min-w-0 flex-col">
			{/* **The record names itself first.** The drawer's trail says the key
			    and nothing else; the version and the fact that it is published are
			    what a reader has to know before reading a single row under them —
			    a published version is immutable (LB1), so *which one am I reading*
			    is the question the rest of the panel is an answer to. */}
			<RecordHeader
				crumbs={[`${workflow.key}@${workflow.version}`]}
				chips={
					<>
						<DetailStatus>v{workflow.version}</DetailStatus>
						{/* Every version the library lists is published — a draft is
						    not selected, not startable and not listed (LB6 · LB8). */}
						<DetailStatus>published</DetailStatus>
					</>
				}
				className="px-3 py-2"
			/>
			<Band title="The plan">
				<PropertyList labelWidth={86}>
					{/* `font-mono` on the value, not `mono` on the row: the row's
					    prop drops a type step with the face, and a property list
					    whose mono values sit a step under its plain ones reads as
					    two lists. The label is the subordinate half; a value is a
					    value. */}
					<PropertyRow label="key">
						<span className="font-mono">
							{workflow.key}@{workflow.version}
						</span>
					</PropertyRow>
					<PropertyRow label="origin">
						{workflow.origin}
						{workflow.promoted_from_run_id ? (
							<DetailProse>from a plan that served</DetailProse>
						) : null}
					</PropertyRow>
					<PropertyRow label="tasks">
						{workflow.nodes.length} ·{" "}
						{`${callables} callable${callables === 1 ? "" : "s"}`}
						{human ? `, ${human} human` : ""}
					</PropertyRow>
					<PropertyRow label="matches">
						<span className="font-mono">
							{workflow.intent.join(" · ") || "any"}
						</span>
					</PropertyRow>
					<PropertyRow label="owner">
						the library
						<DetailProse>
							<span className="font-mono">reusable: true</span>
						</DetailProse>
					</PropertyRow>
					{/* **Permission, not use.** An agent whose envelope lists this plan
					    *may run* it; who actually calls it is the section below, and
					    conflating the two made `used by` answer neither question. */}
					{workflow.used_by.length ? (
						<PropertyRow label="may run">
							<AgentChipRow agents={workflow.used_by} onOpen={onOpenAgent} />
						</PropertyRow>
					) : null}
				</PropertyList>
			</Band>

			<PlanLayers layers={workflow.declared_layers} nodes={workflow.nodes} />

			<PlanCallers callers={workflow.callers} args={workflow.args_schema} />

			{/* **How it has behaved**, which is a different question from *what is
			    it* (LB10). It belongs on the plan dashboard beside the flow; until
			    that board ships this is the only place it is answered, and dropping
			    it would lose the fact rather than move it. */}
			<Band
				title="How it has behaved"
				aside={workflow.runs ? `${workflow.runs} runs` : undefined}
			>
				<PropertyList labelWidth={86}>
					<PropertyRow label="served">
						{workflow.runs === 0 ? (
							<span className="text-muted-foreground">never run</span>
						) : workflow.served_rate === null ? (
							// Never 0%: *never asked* and *asked and failed* are different
							// facts, and one of them is not a verdict on the plan.
							<span className="text-muted-foreground">none verified yet</span>
						) : (
							`${Math.round(workflow.served_rate * 100)}% of verified runs`
						)}
					</PropertyRow>
					{workflow.last_run_at ? (
						<PropertyRow label="last run">
							{new Date(workflow.last_run_at).toLocaleDateString()}
						</PropertyRow>
					) : null}
				</PropertyList>
			</Band>
		</div>
	);
}

/**
 * **Layers it declares** — the five governed bands, and what this plan will
 * engage in each ([LB17](docs/for-developers/modules/workflows/features/the-library.md) ·
 * [LB22](docs/for-developers/modules/workflows/features/the-library.md)).
 *
 * The same five bands a world governs and a run records, read in the *declared*
 * tense — which is what makes *declared versus touched* a comparison rather
 * than two vocabularies. It is the **same component** in both tenses, on the
 * same axis: `LayerStrip` on `scale="seq"` here, on `scale="elapsed"` for a run
 * ([D20](docs/for-developers/governance.md)). A plan has no clock, so its axis
 * is its own order and `depth` is that order — two steps at the same depth wait
 * on the same thing, not on each other.
 *
 * **Every band is drawn, declared or not.** A band this plan never engages is
 * muted and carries its own `—`, because *this plan leaves the graph alone* is
 * the fact a person opening a plan they did not write is checking for
 * ([D22](docs/for-developers/governance.md)). Muting is the kit's; this file's
 * part is to pass all five bands rather than filtering to the declared ones.
 *
 * **The bands arrive shut** (LB29). A 420px drawer cannot hold a participant
 * row of mono addresses beside a track, and shut is not less information: the
 * tasks drop onto their band's own line, so the whole plan is five lines and
 * one picture ([D21](docs/for-developers/governance.md)). Opening a band is one
 * click, and the kit remembers which are open.
 */
function PlanLayers({
	layers,
	nodes,
}: { layers: TaskPlanLayer[]; nodes: TaskPlanDagNode[] }) {
	const declared = layers.filter((l) => l.declared).length;

	// A band's participants are the catalogue entries the plan's own steps name
	// — derived from the nodes rather than sent beside them, because the nodes
	// are what the canvas draws and a second list would be a second truth.
	const partsOf = (layer: SkillLayer) => {
		const seen = new Map<string, string>();
		for (const node of nodes) {
			if (node.layer !== layer || !node.task) continue;
			if (!seen.has(node.task)) seen.set(node.task, node.task);
		}
		return [...seen.values()].map((task) => ({ id: task, label: task }));
	};

	const bands: LayerBand[] = layers.map((band) => ({
		layer: slugOf(band.layer),
		// The engine phrases the summary — `2 steps` · `1 crossing` · `—` — so
		// the band says what it declares in the same words the list row does.
		note: band.summary,
		parts: band.declared ? partsOf(band.layer) : [],
	}));

	const items: LayerItem[] = nodes.map((node) => ({
		id: node.id,
		label: node.label,
		layer: slugOf(node.layer),
		// A human step has no catalogue entry, so it sits on the band itself
		// rather than inventing a participant for it.
		part: node.task || undefined,
		start: node.depth,
		end: node.depth + 1,
		// The plan tense. Every bar here is something the playbook **will**
		// engage — what it did engage is the run's strip, and the two states are
		// deliberately not the same word.
		state: "declared",
		note: node.form === "human" ? "form: human" : undefined,
	}));

	return (
		<Band title="Layers it declares" aside={`${declared} of ${layers.length}`}>
			<LayerStrip
				bands={bands}
				items={items}
				scale="seq"
				palette={LAYER_PALETTE}
				defaultCollapsed={bands.map((b) => b.layer)}
				// Tuned for the drawer, not for a page: the kit's defaults assume a
				// main region, and 15.5rem of labels beside a 26rem track scrolls
				// horizontally before it has drawn anything.
				labelWidth={9}
				minTrackWidth={13}
				minSlotWidth={5}
			/>
			{/* The spine is not a band a plan declares: the runtime is what
			    dispatches the plan, never something the plan engages. Saying so
			    once is cheaper than a reader counting five and expecting six. */}
			<p className="pt-1 text-sm text-muted-foreground">
				The agent spine is not declared — it is what dispatches the rest.
			</p>
		</Band>
	);
}

/**
 * **Used by** — the callers that inline this plan, and what each tuned
 * ([LB19](docs/for-developers/modules/workflows/features/the-library.md)).
 *
 * Two skills may inline one plan with different arguments and **neither is a
 * fork** — so the value a caller set is the thing worth showing beside its
 * name. A name absent from the plan's `args_schema` cannot be tuned at all,
 * which is why the empty state names what is on offer rather than saying
 * nothing.
 */
function PlanCallers({
	callers,
	args,
}: {
	callers: TaskPlanCaller[];
	args: TaskPlanDetail["args_schema"];
}) {
	const declared = Object.keys(args ?? {});
	return (
		<Band
			title="Used by"
			aside={
				callers.length
					? `${callers.length} caller${callers.length === 1 ? "" : "s"}`
					: undefined
			}
		>
			{callers.length === 0 ? (
				<p className="text-muted-foreground">
					Nothing inlines it yet.
					{declared.length
						? ` It offers ${declared.map((n) => n).join(" · ")} to a caller that does.`
						: " It declares no arguments, so a caller takes it as it is."}
				</p>
			) : (
				<div className="flex min-w-0 flex-col">
					{callers.map((caller) => {
						const tuned = Object.entries(caller.args ?? {});
						return (
							<div
								key={`${caller.kind}-${caller.name}-${caller.version}`}
								className="flex min-w-0 items-baseline gap-2 py-0.5"
							>
								<Wand2 className="size-3 shrink-0 translate-y-0.5 text-info" />
								<span className="min-w-0 flex-1 truncate text-base">
									{caller.name}
								</span>
								<span className="shrink-0 font-mono text-sm text-muted-foreground">
									{/* What it tuned, or that it took the plan's own defaults —
									    which is a fact, not a blank. */}
									{tuned.length
										? tuned.map(([k, v]) => `${k} ${String(v)}`).join(" · ")
										: "the defaults"}
								</span>
							</div>
						);
					})}
				</div>
			)}
		</Band>
	);
}

/**
 * A library row's two lines: what the plan is *for*, then what it will engage
 * and how much use it has had.
 *
 * The bands are on the row, not only in the detail, because *what will this
 * cost me* is the question a person scans a library with — and a row that
 * answered it only after a click would make the list a set of names.
 */
function PlanRowLines({ workflow }: { workflow: TaskPlanSummary }) {
	return (
		<span className="flex min-w-0 flex-1 flex-col gap-1">
			<span className="truncate">
				{workflow.description || `${workflow.step_count} steps`}
			</span>
			<span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
				{/* The **spine** is dropped: every plan is dispatched by the runtime,
				    so a chip saying so on every row carries nothing — and the detail
				    says the same thing once, in words. */}
				{workflow.layers
					.filter((layer) => layer !== "agent")
					.map((layer) => (
						<LayerChip
							key={layer}
							layer={slugOf(layer)}
							palette={LAYER_PALETTE}
						/>
					))}
				<span className="ml-auto shrink-0 text-sm">
					{/* Callers first: a plan two skills inline is reused, which is a
					    stronger reason to reach for it than a run count. Where nothing
					    inlines it, how often it ran is the honest second best. */}
					{workflow.caller_count
						? `used by ${workflow.caller_count} caller${workflow.caller_count === 1 ? "" : "s"}`
						: workflow.runs
							? `ran ${workflow.runs.toLocaleString()}×`
							: "never run"}
				</span>
			</span>
		</span>
	);
}

/**
 * The selected step. Nothing here is editable, and the affordance for that
 * lives in the *container* — bare mono values on labelled rows — rather than in
 * a greyed-out state (docs/for-developers/modules/explore/features/selection-and-the-panel.md).
 */
function StepDetail({
	step,
	workflow,
	onOpenAgent,
}: {
	step: TaskPlanDagNode;
	workflow: TaskPlanDetail;
	onOpenAgent?: (id: string) => void;
}) {
	const requiredBy = workflow.edges.filter(
		(e) => e.target === step.id && e.kind === "order",
	);
	const feeds = workflow.edges.filter(
		(e) => e.source === step.id && e.kind === "binding",
	);
	const consumes = workflow.edges.filter(
		(e) => e.target === step.id && e.kind === "binding",
	);

	return (
		<DetailBlock
			title={step.label}
			subtitle={`${workflow.key}@${workflow.version}`}
		>
			<PropertyRow label="task">
				<DetailStatus>{step.task}</DetailStatus>
			</PropertyRow>
			{requiredBy.length ? (
				<PropertyRow label="after" mono>
					{requiredBy.map((e) => e.source).join(", ")}
					<DetailProse>runs first — required order</DetailProse>
				</PropertyRow>
			) : (
				<PropertyRow label="after">
					nothing
					<DetailProse>the first step</DetailProse>
				</PropertyRow>
			)}
			{consumes.length ? (
				<PropertyRow label="consumes" mono>
					{consumes.map((e) => e.label).join(" · ")}
				</PropertyRow>
			) : null}
			{feeds.length ? (
				<PropertyRow label="feeds" mono>
					{feeds.map((e) => `${e.target} (${e.label})`).join(" · ")}
				</PropertyRow>
			) : null}
			{Object.keys(step.args).length ? (
				<PropertyRow label="args" mono>
					{Object.entries(step.args).map(([k, v]) => (
						<div key={k}>
							{k}: {String(v)}
							{step.pinned.includes(k) ? (
								<>
									{" "}
									{/* A **count**, never a claim — see the module note. */}
									<DetailStatus>
										{step.pinned_by_count > 1
											? `pinned by ${step.pinned_by_count}`
											: "pinned"}
									</DetailStatus>
								</>
							) : null}
						</div>
					))}
				</PropertyRow>
			) : null}
			{step.pinned_by.length ? (
				<PropertyRow label="pinned by">
					<AgentChipRow agents={step.pinned_by} onOpen={onOpenAgent} />
					<div className="mt-1 text-muted-foreground">
						a pin lives on an agent's envelope, which is where it changes
					</div>
				</PropertyRow>
			) : null}
		</DetailBlock>
	);
}
