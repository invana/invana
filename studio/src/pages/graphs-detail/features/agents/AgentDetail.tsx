/**
 * The agent surface — the **one** work panel that edits (`Agents at Work`
 * hi-fi, *Agent · envelope on canvas*).
 *
 * Every other work detail states facts: bare values on labelled rows, no
 * containers, nothing greyed out (see {@link DetailRows}). This one is the
 * deliberate exception, and the design keeps the two visibly distinct so a
 * read-only detail never reads as broken (docs/for-developers/modules/explore/features/selection-and-the-panel.md): here a value that can
 * change sits in a bordered field, and a value that cannot — a pin's owner, a
 * template's key — keeps the statement grammar.
 *
 * ## What is editable, and what is not
 *
 * | Block | Editable | Why |
 * |---|---|---|
 * | Brief | yes | it is this agent's own prose, on top of the graph instructions |
 * | Bindings — LLM, skills | yes | which model and which prose it is offered |
 * | Budget · Policy | yes | the bounds a person sets on an agent |
 * | Workflow envelope — allow · pins · require | yes | the envelope *is* the agent |
 * | Templates | listed, not authored | a workflow is shared; authoring one is post-MVP |
 * | Recent plans | read-only | a run happened; it is a record, not a setting |
 *
 * ## Save is explicit
 *
 * Nothing here autosaves. An envelope is a permission boundary, and a boundary
 * that moves while you are looking at it is one nobody can reason about — so
 * edits accumulate locally, the status bar says `unsaved changes`, and one
 * **Save** writes them.
 */

import { useLLMProvidersQuery } from "@/hooks/queries/useLLMProviders";
import { useSkillsQuery } from "@/hooks/queries/useSkills";
import {
	useAgentLineageQuery,
	useRunsQuery,
	useTasksQuery,
} from "@/hooks/queries/useWork";
import {
	DetailProse,
	DetailStatus,
} from "@/pages/graphs-detail/shared/DetailRows";
import { WorkRow } from "@/pages/graphs-detail/shared/WorkRow";
import {
	agentTone,
	humanStatus,
	taskTone,
	verdictLabel,
	verdictTone,
} from "@/pages/graphs-detail/shared/statusTone";
import type { Agent, AgentUpdate, TaskRunSummary } from "@/types/work";
import { PanelSection } from "@/ui/PanelSection";
import { PanelStatusBar, StatusCount, StatusCrumb } from "@/ui/PanelStatusBar";
import { PolicyFlag } from "@/ui/PolicyFlag";
import {
	Button,
	CardFooter,
	PropertyRow,
	Spinner,
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
	cn,
} from "@invana/ui";
import { Archive, Pause, Play, Save, Star } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

/** `template nl-compare@3 · 7 steps · 1 replan` — where the plan came from. */
function planProvenance(plan: TaskRunSummary): string {
	const source = plan.plan_origin ?? "no plan recorded";
	const bits = [
		source.startsWith("template:")
			? `template ${source.slice("template:".length)}`
			: source,
		`${plan.step_count} step${plan.step_count === 1 ? "" : "s"}`,
	];
	if (plan.replans)
		bits.push(`${plan.replans} replan${plan.replans === 1 ? "" : "s"}`);
	return bits.join(" · ");
}

/**
 * Every step the interpreter knows. The allow-list is drawn against this whole
 * set rather than against itself, because *what this agent may not do* is as
 * much of the answer as what it may — an allow-list shown alone always looks
 * complete.
 */
export const ALL_TASKS = [
	"understand_intent",
	"plan_workflow",
	"translate_thought",
	"validate_query",
	"execute_graph_query",
	"shape_for_canvas",
	"compare_results",
	"chart_result",
	"verify_result",
	"spawn_agent",
	"delegate",
	"await_delegations",
	"create_task",
];

/** The envelope, as this file reads and writes it. */
interface Envelope {
	entry?: string;
	allow?: string[];
	require?: { task: string; after: string }[];
	pins?: Record<string, Record<string, unknown>>;
	templates?: string[];
}

/** The local edit buffer — what `Save` will send. */
interface Draft {
	instructions: string;
	llm_config_id: string | null;
	budget: Record<string, number>;
	policy: Record<string, boolean>;
	spec: Envelope;
}

const draftOf = (agent: Agent): Draft => ({
	instructions: agent.instructions ?? "",
	llm_config_id: agent.llm_config_id,
	budget: { ...(agent.budget ?? {}) },
	policy: { ...(agent.policy ?? {}) },
	spec: JSON.parse(JSON.stringify(agent.workflow_spec ?? {})) as Envelope,
});

type AgentTab = "agent" | "work" | "lineage";

const BUDGET_FIELDS: { key: string; label: string }[] = [
	{ key: "max_steps", label: "steps" },
	{ key: "max_replans", label: "replans" },
	{ key: "max_children", label: "children" },
	{ key: "max_depth", label: "depth" },
	{ key: "max_usd", label: "$" },
];

const POLICY_FIELDS: { key: string; label: string }[] = [
	{ key: "can_spawn", label: "spawn" },
	{ key: "assignable", label: "assignable" },
	{ key: "unattended", label: "unattended" },
];

export function AgentDetail({
	username,
	graphSlug,
	agent,
	isDefault,
	onBack,
	onSave,
	onPause,
	onResume,
	onRetire,
	onSetDefault,
	onOpenTask,
	onOpenLineage,
	onOpenEnvelope,
	onBindSkill,
	onUnbindSkill,
	isSaving,
	isBinding,
}: {
	username: string;
	graphSlug: string;
	agent: Agent;
	isDefault: boolean;
	onBack: () => void;
	onSave: (data: AgentUpdate) => void;
	onPause: () => void;
	onResume: () => void;
	onRetire: () => void;
	onSetDefault: () => void;
	onOpenTask?: (id: string) => void;
	onOpenLineage: () => void;
	onOpenEnvelope: () => void;
	onBindSkill: (skillId: string) => void;
	onUnbindSkill: (skillId: string) => void;
	isSaving?: boolean;
	isBinding?: boolean;
}) {
	const [tab, setTab] = useState<AgentTab>("agent");
	// Keyed by agent id: selecting a different agent starts a fresh buffer rather
	// than carrying one agent's unsaved envelope onto another's.
	const [draftFor, setDraftFor] = useState(agent.id);
	const [draft, setDraft] = useState<Draft>(() => draftOf(agent));
	/**
	 * The envelope as raw text, when someone opens the editor.
	 *
	 * The hi-fi labels this **edit YAML**. The stored envelope is JSON — YAML is
	 * the *workflow library's* surface form (`/workflows/{key}/export`), not the
	 * agent's — so this edits the spec in the shape it is actually saved in.
	 * Adding a YAML parser to round-trip a JSON document through a second syntax
	 * would buy a label and cost a dependency, a lossy conversion, and a class
	 * of "it reformatted my envelope" bug.
	 *
	 * `null` = closed. The text is held apart from `draft` so an invalid
	 * intermediate state (you are mid-keystroke inside a string) never destroys
	 * the structured edits underneath it.
	 */
	const [rawSpec, setRawSpec] = useState<string | null>(null);
	const [rawError, setRawError] = useState<string | null>(null);
	if (draftFor !== agent.id) {
		setDraftFor(agent.id);
		setDraft(draftOf(agent));
		setRawSpec(null);
		setRawError(null);
	}

	// Opening an agent opens its envelope. The tab handler below only fires on a
	// *change*, so without this the surface mounts on `Agent` with whatever the
	// roster had drawn still on the canvas — the panel and the canvas describing
	// two different things.
	// biome-ignore lint/correctness/useExhaustiveDependencies: run per agent, not per handler identity
	useEffect(() => {
		if (tab !== "lineage") onOpenEnvelope();
	}, [agent.id]);

	const llms = useLLMProvidersQuery(username, graphSlug);
	const skills = useSkillsQuery(username, graphSlug);
	const lineage = useAgentLineageQuery(username, graphSlug, agent.id);
	const tasks = useTasksQuery(username, graphSlug, { assignee: agent.id });
	// What this agent has actually run. A record, never a setting — so it keeps
	// the read-only grammar even here, on the one surface that edits.
	const plans = useRunsQuery(username, graphSlug, {
		agentId: agent.id,
		limit: 8,
	});

	const dirty = useMemo(
		() => JSON.stringify(draft) !== JSON.stringify(draftOf(agent)),
		[draft, agent],
	);

	const allow = new Set(draft.spec.allow ?? []);
	const pins = draft.spec.pins ?? {};
	const require = draft.spec.require ?? [];
	const templates = draft.spec.templates ?? [];
	const notAllowed = ALL_TASKS.filter((t) => !allow.has(t));

	const patch = (next: Partial<Draft>) => setDraft((d) => ({ ...d, ...next }));
	const patchSpec = (next: Partial<Envelope>) =>
		setDraft((d) => ({ ...d, spec: { ...d.spec, ...next } }));

	const toggleAllow = (task: string) => {
		const next = new Set(allow);
		if (next.has(task)) next.delete(task);
		else next.add(task);
		patchSpec({ allow: ALL_TASKS.filter((t) => next.has(t)) });
	};

	const myTasks = tasks.data?.items ?? [];
	const children = (lineage.data?.nodes ?? []).filter(
		(n) => n.kind === "agent" && n.id !== agent.id,
	);

	return (
		<div className="flex min-h-0 flex-1 flex-col">
			<div className="flex items-center gap-2 border-b px-3 py-1.5">
				<button
					type="button"
					onClick={onBack}
					className="shrink-0 text-sm text-muted-foreground hover:text-foreground"
				>
					← Agents
				</button>
				<DetailStatus tone={agentTone(agent.status)}>
					{humanStatus(agent.status)}
				</DetailStatus>
			</div>

			<div className="flex shrink-0 items-center gap-2 px-4 pb-1 pt-2 text-sm">
				<DetailStatus>{agent.kind}</DetailStatus>
				<span className="truncate text-muted-foreground">
					v{agent.version}
					{agent.lifetime === "ephemeral" ? " · ephemeral" : ""}
					{isDefault ? " · graph default" : ""}
				</span>
			</div>

			<Tabs
				size="sm"
				value={tab}
				onValueChange={(v) => {
					const next = v as AgentTab;
					setTab(next);
					// The tab and the canvas are one control: reading the envelope with
					// the lineage drawn behind it would be two answers to one question.
					if (next === "lineage") onOpenLineage();
					else onOpenEnvelope();
				}}
				className="flex min-h-0 flex-1 flex-col"
			>
				<TabsList className="w-full justify-start gap-1 px-3">
					<TabsTrigger value="agent">Agent</TabsTrigger>
					<TabsTrigger value="work">Work ({myTasks.length})</TabsTrigger>
					<TabsTrigger value="lineage">Lineage</TabsTrigger>
				</TabsList>

				{/* ── Agent ─────────────────────────────────────────────────────── */}
				<TabsContent value="agent" className="min-h-0 flex-1 overflow-y-auto">
					<PanelSection title="Brief" hint="on top of graph instructions">
						<textarea
							value={draft.instructions}
							onChange={(e) => patch({ instructions: e.target.value })}
							rows={4}
							placeholder="What this agent is for, and which path through the graph it should prefer."
							className="w-full resize-y rounded-sm border bg-background px-2 py-1.5 text-sm"
						/>
					</PanelSection>

					<PanelSection title="Bindings">
						<div className="space-y-2">
							<label className="block text-sm text-muted-foreground">
								LLM
								<select
									value={draft.llm_config_id ?? ""}
									onChange={(e) =>
										patch({ llm_config_id: e.target.value || null })
									}
									className="mt-1 w-full rounded-sm border bg-background px-2 py-1.5 text-sm text-foreground"
								>
									<option value="">graph default</option>
									{(llms.data?.items ?? []).map((llm) => (
										<option key={llm.id} value={llm.id}>
											{llm.provider} · {llm.model_id}
										</option>
									))}
								</select>
							</label>

							<div>
								<div className="mb-1 text-sm text-muted-foreground">Skills</div>
								<div className="flex flex-wrap gap-1">
									{(skills.data?.items ?? []).map((skill) => {
										const on = (agent.skill_ids ?? []).includes(skill.id);
										return (
											<button
												key={skill.id}
												type="button"
												/* Binding is its own write, not part of Save: a bind can
												   be refused on its own, and a refusal that arrived with
												   six other edits could not say which one it was about. */
												disabled={isBinding}
												onClick={() =>
													on ? onUnbindSkill(skill.id) : onBindSkill(skill.id)
												}
												title={skill.when_to_use || skill.description}
												className={cn(
													"rounded-sm border px-2 py-0.5 text-sm",
													on
														? "border-primary/40 bg-primary/10 text-primary"
														: "border-border text-muted-foreground hover:text-foreground",
												)}
											>
												{skill.name}
											</button>
										);
									})}
									{skills.data?.items.length ? null : (
										<span className="text-sm text-muted-foreground">
											No skills in this graph yet.
										</span>
									)}
								</div>
							</div>
						</div>
					</PanelSection>

					<PanelSection
						title="Budget"
						hint="empty means the graph default applies"
					>
						<div className="flex flex-wrap gap-1.5">
							{BUDGET_FIELDS.map((field) => (
								<label
									key={field.key}
									className="inline-flex items-center gap-1.5 rounded-sm border px-2 py-1 text-sm"
								>
									<span className="text-muted-foreground">{field.label}</span>
									<input
										type="number"
										min={0}
										value={draft.budget[field.key] ?? ""}
										placeholder="—"
										onChange={(e) => {
											const next = { ...draft.budget };
											if (e.target.value === "") delete next[field.key];
											else next[field.key] = Number(e.target.value);
											patch({ budget: next });
										}}
										className="w-14 bg-transparent text-sm font-medium text-foreground outline-none"
									/>
								</label>
							))}
						</div>
					</PanelSection>

					<PanelSection
						title="Policy"
						hint="a dash means the graph default applies"
					>
						<div className="flex flex-wrap gap-1.5">
							{POLICY_FIELDS.map((field) => (
								<PolicyFlag
									key={field.key}
									label={field.label}
									on={draft.policy[field.key]}
									onToggle={(next) => {
										const policy = { ...draft.policy };
										// Clearing *removes* the key — writing `false` would
										// turn "the graph decides" into a denial nobody chose.
										if (next === undefined) delete policy[field.key];
										else policy[field.key] = next;
										patch({ policy });
									}}
								/>
							))}
						</div>
					</PanelSection>

					{/* ── The envelope ──────────────────────────────────────────── */}
					<PanelSection
						title="Workflow envelope"
						action={
							<span className="flex items-center gap-2.5">
								<button
									type="button"
									onClick={() => {
										setRawError(null);
										setRawSpec(
											rawSpec === null
												? JSON.stringify(draft.spec, null, 2)
												: null,
										);
									}}
									className="text-xs text-muted-foreground hover:text-foreground"
								>
									{rawSpec === null ? "edit spec" : "done"}
								</button>
								<button
									type="button"
									onClick={onOpenEnvelope}
									className="text-xs text-muted-foreground hover:text-foreground"
								>
									draw it ▸
								</button>
							</span>
						}
					>
						{rawSpec !== null ? (
							<div className="space-y-1.5">
								<textarea
									value={rawSpec}
									onChange={(e) => {
										setRawSpec(e.target.value);
										// Parse on every keystroke but only *commit* a valid
										// document: the structured fields above stay usable, and
										// the error names the problem instead of silently
										// discarding what you typed.
										try {
											const parsed = JSON.parse(e.target.value);
											if (
												parsed === null ||
												typeof parsed !== "object" ||
												Array.isArray(parsed)
											)
												throw new Error("An envelope is an object.");
											patchSpec(parsed as Envelope);
											setRawError(null);
										} catch (err) {
											setRawError(
												err instanceof Error ? err.message : "Invalid JSON.",
											);
										}
									}}
									spellCheck={false}
									rows={14}
									className="w-full resize-y rounded-sm border bg-background px-2 py-1.5 font-mono text-sm"
								/>
								{rawError ? (
									<p className="text-sm text-destructive">{rawError}</p>
								) : (
									<p className="text-sm text-muted-foreground">
										Valid — Save writes it. The fields above follow this
										document.
									</p>
								)}
							</div>
						) : (
							<dl className="space-y-2">
								<PropertyRow label="entry">
									<span className="font-mono">
										{draft.spec.entry ?? "plan"}
									</span>
									<DetailProse>
										{draft.spec.entry === "understand" || !draft.spec.entry
											? "a planning agent — it composes a plan per ask"
											: "runs a fixed workflow"}
									</DetailProse>
								</PropertyRow>

								<div className="grid grid-cols-[110px_1fr] gap-2 text-sm">
									<dt className="text-muted-foreground">allow</dt>
									<dd className="min-w-0">
										<div className="flex flex-wrap gap-1">
											{ALL_TASKS.map((task) => (
												<button
													key={task}
													type="button"
													onClick={() => toggleAllow(task)}
													className={cn(
														"rounded-sm border px-1.5 py-0.5 font-mono text-sm",
														allow.has(task)
															? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
															: "border-dashed border-border text-muted-foreground hover:text-foreground",
													)}
													title={
														allow.has(task)
															? "Allowed — click to remove"
															: "Not allowed — click to permit"
													}
												>
													{task.replace(/_.*/, "")}
												</button>
											))}
										</div>
										{notAllowed.length ? (
											<div className="mt-1 text-muted-foreground">
												{notAllowed.length} not allowed
											</div>
										) : null}
									</dd>
								</div>

								<PropertyRow label="pinned" mono>
									{Object.keys(pins).length ? (
										Object.entries(pins).map(([task, args]) => (
											<div key={task}>
												{task}.{Object.keys(args).join(", ")}
												{" = "}
												{Object.values(args).map(String).join(", ")}
											</div>
										))
									) : (
										<span className="text-muted-foreground">
											nothing pinned
										</span>
									)}
								</PropertyRow>
								<PropertyRow label="require" mono>
									{require.length ? (
										require.map((r) => `${r.task} ← ${r.after}`).join(" · ")
									) : (
										<span className="text-muted-foreground">
											no ordering rules
										</span>
									)}
								</PropertyRow>
								<PropertyRow label="templates" mono>
									{templates.length ? (
										templates.join(" · ")
									) : (
										<span className="text-muted-foreground">
											any workflow the library offers
										</span>
									)}
								</PropertyRow>
							</dl>
						)}
						<p className="mt-2 text-sm text-muted-foreground">
							A plan is validated against this before it runs. The envelope
							bounds what any plan may contain.
						</p>
					</PanelSection>
					{/* ── Recent plans ──────────────────────────────────────────── */}
					<PanelSection title="Recent plans" hint="what this agent has run">
						{plans.isLoading ? (
							<Spinner />
						) : !plans.data?.items.length ? (
							<p className="text-sm text-muted-foreground">
								This agent has not run yet.
							</p>
						) : (
							<ul className="space-y-1.5">
								{plans.data.items.map((plan) => (
									<li key={plan.id} className="flex items-start gap-2 text-sm">
										<span className="min-w-0 flex-1">
											<span className="block truncate text-foreground">
												{plan.task_title ?? plan.workflow_key}
											</span>
											<span className="block truncate text-muted-foreground">
												{planProvenance(plan)}
											</span>
										</span>
										{/*
										 * `served` is the verdict, and it has three values plus
										 * absent. Absent means the run never reached Verify —
										 * drawn as the status rather than as "no", because
										 * "nobody asked" and "asked and failed" are different
										 * facts (the same rule the library's rate follows).
										 */}
										<DetailStatus
											tone={
												plan.served
													? verdictTone(plan.served)
													: plan.status === "failed"
														? "error"
														: "muted"
											}
										>
											{plan.served ? verdictLabel(plan.served) : plan.status}
										</DetailStatus>
									</li>
								))}
							</ul>
						)}
					</PanelSection>
				</TabsContent>

				{/* ── Work ──────────────────────────────────────────────────────── */}
				<TabsContent value="work" className="min-h-0 flex-1 overflow-y-auto">
					{tasks.isLoading ? (
						<div className="p-4">
							<Spinner />
						</div>
					) : myTasks.length === 0 ? (
						<p className="p-4 text-sm text-muted-foreground">
							This agent has no tasks. Assigning one is what starts it.
						</p>
					) : (
						myTasks.map((task) => (
							<WorkRow
								key={task.id}
								tone={taskTone(task.status)}
								live={task.status === "in_progress"}
								onClick={onOpenTask ? () => onOpenTask(task.id) : undefined}
								title={task.title}
								status={humanStatus(task.status)}
								statusTone={taskTone(task.status)}
								subtitle={
									<span className="truncate">
										{task.project_key ? `${task.project_key} · ` : ""}
										{task.run_ids.length} run
										{task.run_ids.length === 1 ? "" : "s"}
									</span>
								}
							/>
						))
					)}
				</TabsContent>

				{/* ── Lineage ───────────────────────────────────────────────────── */}
				<TabsContent value="lineage" className="min-h-0 flex-1 overflow-y-auto">
					<div className="px-4 py-2.5 text-sm text-muted-foreground">
						{children.length
							? `${children.length} related agent${children.length === 1 ? "" : "s"} · drawn on the canvas`
							: "Nothing was spawned from this agent."}
					</div>
					{children.map((node) => (
						<WorkRow
							key={node.id}
							tone={node.status === "retired" ? "muted" : "success"}
							title={node.label}
							status={node.status ?? undefined}
							subtitle={
								<span className="truncate">
									{[node.agent_kind, node.lifetime].filter(Boolean).join(" · ")}
								</span>
							}
						/>
					))}
				</TabsContent>
			</Tabs>

			<CardFooter className="shrink-0 flex-wrap gap-2 border-t">
				{/* A spec that does not parse must not be savable: the structured
				    fields still hold the last valid document, so Save would write
				    something the editor is not showing. */}
				<Button
					size="sm"
					disabled={!dirty || isSaving || rawError !== null}
					onClick={() =>
						onSave({
							instructions: draft.instructions,
							llm_config_id: draft.llm_config_id,
							budget: draft.budget,
							policy: draft.policy,
							workflow_spec: draft.spec as Record<string, unknown>,
						})
					}
				>
					<Save /> {isSaving ? "Saving…" : "Save"}
				</Button>
				{agent.status === "retired" ? null : (
					<Button
						size="sm"
						variant="outline"
						onClick={agent.status === "paused" ? onResume : onPause}
					>
						{agent.status === "paused" ? <Play /> : <Pause />}
						{agent.status === "paused" ? "Resume" : "Pause"}
					</Button>
				)}
				{!isDefault && agent.status === "active" ? (
					<Button size="sm" variant="outline" onClick={onSetDefault}>
						<Star /> Set as default
					</Button>
				) : null}
				{agent.status === "retired" ? null : (
					<>
						<span className="flex-1" />
						<Button size="sm" variant="ghost" onClick={onRetire}>
							<Archive /> Retire…
						</Button>
					</>
				)}
			</CardFooter>

			<PanelStatusBar
				left={
					<>
						<StatusCrumb
							active={tab === "agent"}
							onClick={() => setTab("agent")}
						>
							Agent
						</StatusCrumb>
						<StatusCrumb active={tab === "work"} onClick={() => setTab("work")}>
							Work
						</StatusCrumb>
						<StatusCrumb
							active={tab === "lineage"}
							onClick={() => {
								setTab("lineage");
								onOpenLineage();
							}}
						>
							Lineage
						</StatusCrumb>
					</>
				}
				middle={[
					<StatusCount key="allow" tone={allow.size ? "info" : "muted"}>
						{allow.size} of {ALL_TASKS.length} steps allowed
					</StatusCount>,
				]}
				right={
					dirty ? (
						<StatusCount tone="warning">unsaved changes</StatusCount>
					) : undefined
				}
			/>
		</div>
	);
}
