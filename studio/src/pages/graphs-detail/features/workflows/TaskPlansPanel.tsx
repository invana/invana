/**
 * The workflow library (docs/for-developers/modules/agents/spec.md, journey J6).
 *
 * **Read-only, and it says so.** Authoring a workflow is out of MVP — a spec
 * drives dispatch, so authoring is an execution surface and needs its own
 * threat model. The status bar states that rather than leaving a user to
 * discover it by clicking; a canvas is not a loophole in a threat model
 * (docs/for-developers/modules/explore/features/selection-and-the-panel.md).
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
	DetailPlaceholder,
	DetailProse,
	DetailStatus,
} from "@/pages/graphs-detail/shared/DetailRows";
import { WorkRow } from "@/pages/graphs-detail/shared/WorkRow";
import type { TaskPlanDagNode, TaskPlanDetail } from "@/types/work";
import { PanelStatusBar, StatusCrumb } from "@/ui/PanelStatusBar";
import { Button, CardFooter, PropertyRow, Spinner } from "@invana/ui";
import { ArrowUpFromLine, Download } from "lucide-react";
import { useState } from "react";

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
	/** The status bar's `Candidates` crumb narrows the list to them. */
	onSourceFilter: (v: string) => void;
	selectedKey: string | null;
	onSelectKey: (key: string | null) => void;
	/** The step selected on the DAG — the panel's detail swaps to it (D1). */
	selectedStepId: string | null;
	/** Open the workflow as a canvas tab (`kind = workflow`). */
	onOpenCanvas?: (key: string) => void;
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
	onSourceFilter,
	selectedKey,
	onSelectKey,
	selectedStepId,
	onOpenCanvas,
	onOpenAgent,
	exportUrl,
}: Props) {
	const [promoting, setPromoting] = useState(false);
	const list = useWorkflowsQuery(username, graphSlug);
	const detail = useWorkflowQuery(
		username,
		graphSlug,
		selectedKey ?? undefined,
	);

	const items = list.data?.items ?? [];
	const step = detail.data?.nodes.find((n) => n.id === selectedStepId) ?? null;

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
				const promoted = items.filter((w) => w.origin === "promoted").length;
				return (
					<div className="flex h-full min-h-0 flex-col">
						<div className="flex-1 overflow-y-auto">
							{list.isLoading ? (
								<div className="p-4">
									<Spinner />
								</div>
							) : rows.length === 0 ? (
								<p className="p-4 text-sm text-muted-foreground">
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
										subtitle={
											<span className="truncate">
												{workflow.origin} · {workflow.step_count} step
												{workflow.step_count === 1 ? "" : "s"} · used by{" "}
												{workflow.used_by.length} agent
												{workflow.used_by.length === 1 ? "" : "s"}
												{/* Served is the reason to prefer one entry over
												    another, so it belongs on the row — but only once
												    something has been verified. */}
												{workflow.served_rate !== null
													? ` · served ${Math.round(workflow.served_rate * 100)}%`
													: ""}
											</span>
										}
									/>
								))
							)}
						</div>

						{step && detail.data ? (
							<StepDetail
								step={step}
								workflow={detail.data}
								onOpenAgent={onOpenAgent}
							/>
						) : detail.data ? (
							<TaskPlanDetailBlock
								workflow={detail.data}
								onOpenCanvas={onOpenCanvas}
								onOpenAgent={onOpenAgent}
							/>
						) : (
							<DetailPlaceholder hint="Pick a workflow to see what it does, which agents use it, and how its steps feed each other." />
						)}

						<CardFooter className="shrink-0 flex-wrap gap-2 border-t">
							<Button
								size="sm"
								title="Turn a plan that served into a reusable entry — the only write this library takes"
								onClick={() => setPromoting(true)}
							>
								<ArrowUpFromLine /> Promote a plan…
							</Button>
							{exportUrl && detail.data ? (
								<Button
									size="sm"
									variant="outline"
									onClick={() => {
										window.open(
											exportUrl(detail.data.key ?? ""),
											"_blank",
											"noopener",
										);
									}}
								>
									<Download /> Export YAML
								</Button>
							) : null}
						</CardFooter>

						{/* Stating the deferral is the design, not an apology for it. */}
						<PanelStatusBar
							left={
								<>
									<StatusCrumb active>Library</StatusCrumb>
									<StatusCrumb
										onClick={
											promoted ? () => onSourceFilter("promoted") : undefined
										}
									>
										Promoted ({promoted})
									</StatusCrumb>
								</>
							}
							middle={[
								`${items.length} workflow${items.length === 1 ? "" : "s"}`,
							]}
							right={`authoring: ${list.data?.authoring ?? "post-MVP"}`}
						/>
					</div>
				);
			})()}
			<PromoteDialog
				username={username}
				graphSlug={graphSlug}
				open={promoting}
				onOpenChange={setPromoting}
				// Land on what you just made: the new entry is selected, and its DAG
				// opens, so a promotion ends by showing the thing it created.
				onPromoted={(key) => {
					onSelectKey(key);
					onOpenCanvas?.(key);
				}}
			/>
		</>
	);
}

function TaskPlanDetailBlock({
	workflow,
	onOpenCanvas,
	onOpenAgent,
}: {
	workflow: TaskPlanDetail;
	onOpenCanvas?: (key: string) => void;
	onOpenAgent?: (id: string) => void;
}) {
	const params = Object.keys(
		{}, // Parameters come from `args_schema` when 7.7 lands; the plan has no `spec`.
	);
	// The key's prefix is the family (`nl-compare` → `nl`); the intents are what
	// the planner matches on. Two different facts, so two rows rather than one
	// comma-joined line that hides which is which.
	const kind = (workflow.key ?? "").split("-")[0];
	return (
		<DetailBlock
			title={
				<span className="flex items-center gap-2">
					<span className="font-mono">
						{workflow.key}@{workflow.version}
					</span>
					<DetailStatus
						tone={workflow.origin === "builtin" ? "muted" : "success"}
					>
						{workflow.origin}
					</DetailStatus>
				</span>
			}
			subtitle={
				<>
					v{workflow.version}
					{workflow.last_run_at
						? ` · ${new Date(workflow.last_run_at).toLocaleDateString()}`
						: ""}
					{workflow.description ? ` — ${workflow.description}` : ""}
				</>
			}
		>
			<PropertyRow label="matches" mono>
				intent: {workflow.intent.join(" · ") || "any"}
				<br />
				kind: {kind}
			</PropertyRow>
			{params.length ? (
				<PropertyRow label="params" mono>
					{params.join(" · ")}
				</PropertyRow>
			) : null}
			<PropertyRow label="used by">
				<AgentChipRow agents={workflow.used_by} onOpen={onOpenAgent} />
			</PropertyRow>
			{/* The steps in the order the interpreter walks them. The canvas draws
			    the *partial* order — what waits on what — and these two answer
			    different questions, so the panel keeps the list. */}
			<PropertyRow label={`steps (${workflow.nodes.length})`}>
				<ol className="space-y-0.5">
					{workflow.nodes.map((node, index) => (
						<li key={node.id} className="flex gap-2">
							<span className="w-4 shrink-0 text-right text-muted-foreground">
								{index + 1}
							</span>
							<span className="min-w-0">
								{node.label}{" "}
								<span className="font-mono text-muted-foreground">
									{node.task}
								</span>
								{node.pinned.length ? (
									<span className="text-muted-foreground">
										{" · "}
										{node.pinned_by_count > 1
											? `pinned by ${node.pinned_by_count}`
											: "pinned"}
									</span>
								) : null}
							</span>
						</li>
					))}
				</ol>
			</PropertyRow>
			<PropertyRow label="runs">
				{workflow.runs ? (
					<>
						{workflow.runs}
						{workflow.served_rate === null ? (
							<DetailProse>none verified yet</DetailProse>
						) : (
							<>
								{" · "}
								served {Math.round(workflow.served_rate * 100)}%
							</>
						)}
						{workflow.last_run_at ? (
							<DetailProse>
								last {new Date(workflow.last_run_at).toLocaleDateString()}
							</DetailProse>
						) : null}
					</>
				) : (
					<span className="text-muted-foreground">never run</span>
				)}
			</PropertyRow>
			{workflow.promoted_from_run_id ? (
				<PropertyRow label="source">
					<DetailProse>promoted from a plan that served</DetailProse>
				</PropertyRow>
			) : null}
			{onOpenCanvas ? (
				<Button
					size="sm"
					variant="outline"
					className="mt-2.5 h-7 text-sm"
					onClick={() => onOpenCanvas(workflow.key ?? "")}
				>
					Draw the DAG
				</Button>
			) : null}
		</DetailBlock>
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
