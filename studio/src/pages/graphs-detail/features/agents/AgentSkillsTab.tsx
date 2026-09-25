/**
 * Skills & callables — *what this agent can do*, as two tables that name each
 * other (C12): its **skills** (how it approaches work) above its **callables**
 * (what its envelope lets it run).
 *
 * Both are one read, `…/skills-and-callables`, derived on every request and
 * never stored (AG30). They read the **saved** agent: an envelope edited here
 * redraws the tables after Save, not while it is typed.
 */

import { useSkillsQuery } from "@/hooks/queries/useSkills";
import {
	useAgentSkillsAndCallablesQuery,
	useCatalogueQuery,
} from "@/hooks/queries/useWork";
import { ALL_TASKS } from "@/pages/graphs-detail/features/agents/AgentDetail";
import type {
	AgentDraft,
	Envelope,
} from "@/pages/graphs-detail/features/agents/agentDraft";
import type { Skill } from "@/types/skills";
import type { Agent, AgentCallableRow, AgentSkillRow } from "@/types/work";
import { BindRefusalCard, asBindRefusal } from "@/ui/BindRefusalCard";
import { PanelSection } from "@/ui/PanelSection";
import { Textarea } from "@invana/forms";
import { type ColumnDef, DataTable } from "@invana/tables";
import {
	BoundChip,
	Button,
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
	Spinner,
	cn,
} from "@invana/ui";
import { Plus } from "lucide-react";
import { useMemo, useState } from "react";

export function AgentSkillsTab({
	username,
	graphSlug,
	agent,
	draft,
	onPatch,
	specError,
	onSpecError,
	onOpenEnvelope,
	onBindSkill,
	onUnbindSkill,
	bindError,
	isBinding,
}: {
	username: string;
	graphSlug: string;
	agent: Agent;
	draft: AgentDraft;
	onPatch: (next: Partial<AgentDraft>) => void;
	specError: string | null;
	onSpecError: (error: string | null) => void;
	/** Draws the envelope as a canvas page beside this one. */
	onOpenEnvelope: () => void;
	onBindSkill: (skillId: string) => void;
	onUnbindSkill: (skillId: string) => void;
	bindError?: unknown;
	isBinding?: boolean;
}) {
	const can = useAgentSkillsAndCallablesQuery(username, graphSlug, agent.id);
	const allSkills = useSkillsQuery(username, graphSlug);
	const graphSkills = allSkills.data?.items ?? [];
	const unbound = graphSkills.filter(
		(s) => !(agent.skill_ids ?? []).includes(s.id),
	);
	const nameOf = useMemo(
		() => new Map(graphSkills.map((s) => [s.id, s.name])),
		[graphSkills],
	);

	// Which skill the last bind was for. A refusal floating above the table
	// could not say which skill it was about — the failure BN8 exists to
	// prevent (BN11).
	const [refusedFor, setRefusedFor] = useState<string | null>(null);
	const refusal = asBindRefusal(bindError);
	const refusedSkill =
		refusal && refusedFor
			? (graphSkills.find((s) => s.id === refusedFor) ?? null)
			: null;
	const bindings = bindingsCost(graphSkills, agent.skill_ids ?? []);

	const [editing, setEditing] = useState(false);
	/**
	 * The envelope as raw text. The stored envelope is JSON, so it is edited in
	 * the shape it is saved in. `null` = closed. Held apart from the draft so an
	 * invalid intermediate state never destroys the structured edits under it.
	 */
	const [rawSpec, setRawSpec] = useState<string | null>(null);

	// The allow-list is drawn against the whole catalogue, because what this
	// agent may *not* run is as much of the answer as what it may.
	const catalogue = useCatalogueQuery(username, graphSlug);
	const allKeys = catalogue.data?.items.map((e) => e.step_key) ?? ALL_TASKS;
	const allow = new Set(draft.spec.allow ?? []);
	const patchSpec = (next: Partial<Envelope>) =>
		onPatch({ spec: { ...draft.spec, ...next } });
	const toggleAllow = (task: string) => {
		const current = draft.spec.allow ?? [];
		patchSpec({
			allow: allow.has(task)
				? current.filter((t) => t !== task)
				: [...current, task],
		});
	};

	const skillColumns = useMemo<ColumnDef<AgentSkillRow>[]>(
		() => [
			{
				id: "skill",
				header: "Skill",
				enableSorting: false,
				cell: ({ row }) => (
					<span className="flex min-w-0 flex-col">
						<span className="truncate font-medium">{row.original.name}</span>
						<span className="truncate text-sm text-muted-foreground">
							{row.original.when_to_use}
						</span>
					</span>
				),
			},
			{
				id: "version",
				header: "Ver",
				enableSorting: false,
				cell: ({ row }) =>
					row.original.version == null ? (
						<span className="text-muted-foreground">draft</span>
					) : (
						<span className="font-mono">v{row.original.version}</span>
					),
			},
			{
				id: "needs",
				header: "Needs",
				enableSorting: false,
				cell: ({ row }) => {
					const missing = new Set(row.original.missing);
					return (
						<span className="flex flex-wrap gap-x-1.5 font-mono text-sm">
							{row.original.uses.map((u) => (
								<span key={u} className="text-muted-foreground">
									uses {u}
								</span>
							))}
							{row.original.needs.map((n) => (
								<span
									key={n}
									className={missing.has(n) ? "text-destructive" : undefined}
									title={
										missing.has(n)
											? "This envelope does not allow it"
											: undefined
									}
								>
									{n}
								</span>
							))}
							{row.original.needs.length ? null : (
								<span className="text-muted-foreground">—</span>
							)}
						</span>
					);
				},
			},
			{
				id: "usage",
				header: "Offered / applied",
				enableSorting: false,
				cell: ({ row }) =>
					row.original.enough_to_read ? (
						<span className="font-mono">
							{row.original.offered.toLocaleString()} /{" "}
							{row.original.applied.toLocaleString()}
						</span>
					) : (
						<span className="text-muted-foreground">too few to read</span>
					),
			},
			{
				id: "unbind",
				header: "",
				enableSorting: false,
				cell: ({ row }) => (
					<Button
						size="sm"
						variant="ghost"
						disabled={isBinding}
						onClick={() => {
							setRefusedFor(row.original.skill_id);
							onUnbindSkill(row.original.skill_id);
						}}
					>
						Unbind
					</Button>
				),
			},
		],
		[isBinding, onUnbindSkill],
	);

	const callableColumns = useMemo<ColumnDef<AgentCallableRow>[]>(
		() => [
			{
				id: "callable",
				header: "Callable",
				enableSorting: false,
				cell: ({ row }) => (
					<span className="font-mono">{row.original.step_key}</span>
				),
			},
			{
				id: "bound",
				header: "Bound",
				enableSorting: false,
				cell: ({ row }) => <BoundChip bound={row.original.bound} />,
			},
			{
				id: "pinned",
				header: "Pinned",
				enableSorting: false,
				cell: ({ row }) => {
					const pins = Object.entries(row.original.pinned);
					return pins.length ? (
						<span className="font-mono text-sm">
							{pins.map(([k, v]) => `${k}: ${String(v)}`).join(" · ")}
						</span>
					) : (
						<span className="text-muted-foreground">—</span>
					);
				},
			},
			{
				id: "needed_by",
				header: "Needed by",
				enableSorting: false,
				cell: ({ row }) =>
					row.original.needed_by.length ? (
						<span className="flex flex-wrap gap-x-2 text-sm">
							{row.original.needed_by.map((ref) => (
								<span key={ref} className="whitespace-nowrap">
									{nameOf.get(ref) ?? ref}
								</span>
							))}
						</span>
					) : (
						// Allowed, and a candidate for tightening (EB5).
						<span className="text-muted-foreground">nothing bound</span>
					),
			},
		],
		[nameOf],
	);

	const skills = can.data?.skills ?? [];
	const lacking = skills.filter((s) => s.missing.length);

	return (
		<>
			<PanelSection
				title="Skills"
				hint="how it approaches work"
				action={
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button size="sm" variant="ghost" disabled={isBinding}>
								<Plus /> Bind skill
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end">
							{unbound.length ? (
								unbound.map((skill) => (
									<DropdownMenuItem
										key={skill.id}
										onSelect={() => {
											// The refusal belongs under the skill that raised it, so
											// the pick is remembered before it is sent (BN11).
											setRefusedFor(skill.id);
											onBindSkill(skill.id);
										}}
									>
										{skill.name}
										{/* A bound draft is bound and offered to nothing until
										    it is published (BN14). */}
										{skill.is_draft ? (
											<span className="ml-1 text-muted-foreground">draft</span>
										) : null}
									</DropdownMenuItem>
								))
							) : (
								<DropdownMenuItem disabled>
									Every skill in this Graph is bound
								</DropdownMenuItem>
							)}
						</DropdownMenuContent>
					</DropdownMenu>
				}
			>
				{can.isLoading ? (
					<Spinner />
				) : skills.length ? (
					<DataTable
						columns={skillColumns}
						data={skills}
						enableSorting={false}
						enablePagination={false}
						enableColumnVisibility={false}
					/>
				) : (
					<p className="text-muted-foreground">
						No skills bound — this agent runs on the Graph's base plans alone.
					</p>
				)}
				{lacking.map((s) => (
					<p key={s.skill_id} className="mt-1.5 text-sm text-destructive">
						{s.name} needs{" "}
						<span className="font-mono">{s.missing.join(" and ")}</span>, which
						this envelope does not allow.{" "}
						<Button
							variant="link"
							size="sm"
							className="h-auto p-0"
							onClick={() => setEditing(true)}
						>
							Edit envelope
						</Button>
					</p>
				))}
				{refusal && refusedSkill ? (
					<BindRefusalCard
						className="mt-1.5"
						refusal={refusal}
						subject={refusedSkill.name}
					/>
				) : null}
				{bindings.bound > 0 ? (
					<p className="mt-1.5 text-sm text-muted-foreground">
						{bindings.sentence}
					</p>
				) : null}
			</PanelSection>

			<PanelSection
				title="Callables"
				hint={`${allow.size} of ${allKeys.length} · what its envelope lets it run`}
				action={
					<span className="flex items-center gap-1">
						<Button size="sm" variant="ghost" onClick={onOpenEnvelope}>
							Draw it
						</Button>
						<Button
							size="sm"
							variant="ghost"
							onClick={() => {
								setEditing(!editing);
								setRawSpec(null);
							}}
						>
							{editing ? "Done" : "Edit envelope"}
						</Button>
					</span>
				}
			>
				{editing ? (
					<div className="mb-2 space-y-1.5">
						<div className="flex flex-wrap gap-1">
							{allKeys.map((task) => (
								<button
									key={task}
									type="button"
									onClick={() => toggleAllow(task)}
									aria-pressed={allow.has(task)}
									className={cn(
										"rounded-sm border px-1.5 py-0.5 font-mono text-sm",
										allow.has(task)
											? "border-success/40 bg-success/10 text-success"
											: "border-dashed border-border text-muted-foreground hover:text-foreground",
									)}
								>
									{task}
								</button>
							))}
						</div>
						<Button
							variant="link"
							size="sm"
							className="h-auto p-0"
							onClick={() => {
								onSpecError(null);
								setRawSpec(
									rawSpec === null ? JSON.stringify(draft.spec, null, 2) : null,
								);
							}}
						>
							{rawSpec === null
								? "Pins, order and plans — edit as JSON"
								: "Close JSON"}
						</Button>
						{rawSpec !== null ? (
							<>
								<Textarea
									value={rawSpec}
									onChange={(e) => {
										setRawSpec(e.target.value);
										// Parse on every keystroke but only *commit* a valid
										// document, and name the problem instead of silently
										// discarding what was typed.
										try {
											const parsed = JSON.parse(e.target.value);
											if (
												parsed === null ||
												typeof parsed !== "object" ||
												Array.isArray(parsed)
											)
												throw new Error("An envelope is an object.");
											onPatch({ spec: parsed as Envelope });
											onSpecError(null);
										} catch (err) {
											onSpecError(
												err instanceof Error ? err.message : "Invalid JSON.",
											);
										}
									}}
									spellCheck={false}
									rows={14}
									className="font-mono"
								/>
								{specError ? (
									<p className="text-sm text-destructive">{specError}</p>
								) : null}
							</>
						) : null}
						<p className="text-sm text-muted-foreground">
							A plan is validated against this before it runs. The tables redraw
							after Save.
						</p>
					</div>
				) : null}
				{can.isLoading ? null : (
					<DataTable
						columns={callableColumns}
						data={can.data?.callables ?? []}
						enableSorting={false}
						enablePagination={false}
						enableColumnVisibility={false}
					/>
				)}
			</PanelSection>

			<PanelSection
				title="Plans it may pick"
				hint="the base plans a Plan step may use"
			>
				{can.data?.plans.length ? (
					<p className="flex flex-wrap gap-x-2 font-mono text-sm">
						{can.data.plans.map((p) => (
							<span key={p}>{p}</span>
						))}
					</p>
				) : (
					<p className="text-muted-foreground">Any plan the library offers.</p>
				)}
			</PanelSection>
		</>
	);
}

/**
 * `2 of 3 bound skills are offered — ~4,200 characters in every ask.`
 *
 * A draft is bound and offered to nothing ([BN14]), so it is named apart
 * rather than folded into the cost: counting a draft's prose would report a
 * prompt that is never assembled. Characters, never tokens (BN15).
 */
function bindingsCost(
	skills: Skill[],
	boundIds: string[],
): { bound: number; sentence: string } {
	const bound = skills.filter((s) => boundIds.includes(s.id));
	const offered = bound.filter((s) => !s.is_draft);
	const drafts = bound.length - offered.length;
	const chars = offered.reduce(
		(total, s) => total + s.content.length + s.when_to_use.length,
		0,
	);
	const cost = offered.length
		? `${offered.length === bound.length ? `${bound.length} bound` : `${offered.length} of ${bound.length} bound`} skill${bound.length === 1 ? " is" : "s are"} offered — ~${chars.toLocaleString()} characters in every ask.`
		: "Nothing here is offered yet.";
	return {
		bound: bound.length,
		sentence: drafts
			? `${cost} ${drafts} ${drafts === 1 ? "is a draft" : "are drafts"}, offered to nothing until published.`
			: cost,
	};
}
