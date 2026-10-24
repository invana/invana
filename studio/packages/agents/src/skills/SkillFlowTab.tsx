/**
 * A skill › **Flow** — what the instructions resolve to, read-only.
 *
 * The plan on `TaskFlowCanvas`, top-down as step cards — each reads its
 * function, `step N · from line N` and its bound — with each handler card
 * beside the step it guards and a line the draw could not map drawn as a
 * *? no function* gap card beside the step written before it. Beside it, **From the
 * instructions** maps every line to its step or handler — a line the draw
 * could not map reads as a gap — and **This flow** names the version it was
 * drawn from and the bounds it spends. Selecting a step swaps those for the
 * step's panel: its line, bound, side effect, who needs it and its handler.
 *
 * A line the draw could not map also gets a **Choices** card — *Leave it to a
 * person* · *Rewrite the line*, as on Instructions — which saves the draft
 * and draws again. One click on a step selects it and opens its panel.
 *
 * Nobody edits a plan here: a plan that reads wrong is fixed in the text.
 */

import {
	Badge,
	BoundChip,
	Button,
	EmptyState,
	PropertyList,
	PropertyRow,
	RefusalCard,
	Spinner,
	TypographyInlineCode,
} from "@invana/ui";
import {
	TaskFlowCanvas,
	taskFlowSettings,
	taskFlowTemplates,
} from "@invana-studio/canvases";
import { useAccess } from "@invana-studio/shell";
import { PanelSection } from "@invana-studio/ui";
import { ArrowLeft, PencilLine, Workflow } from "lucide-react";
import { useMemo, useState } from "react";
import { useFunctionQuery } from "../plugins/queries";
import { skillFlowSettings, skillFlowTemplates } from "./flow/skillFlowConfig";
import { replaceLine } from "./instructionsText";
import { useSaveDraftMutation } from "./queries";
import { UnmappedChoices } from "./SkillInstructionsTab";
import { guardedStep, taskFlowFromPlan } from "./taskFlowFromPlan";
import type { SkillPlaybookNode, SkillPlaybookRead } from "./types";
import type { SkillPage } from "./useSkillPage";

export function SkillFlowTab({ page }: { page: SkillPage }) {
	const { plan } = page;
	const [selected, setSelected] = useState<string | null>(null);
	// Keyed on what the lists say, not their identity: a list re-made on every
	// render would hand the canvas new data, which lays it out again and drops
	// the click that selected a step.
	const handlersKey = JSON.stringify(page.handlers);
	const unmappedKey = JSON.stringify(page.unmapped);
	// biome-ignore lint/correctness/useExhaustiveDependencies: the keys stand for the lists
	const data = useMemo(
		() =>
			plan
				? taskFlowFromPlan(
						plan,
						page.handlers,
						page.lineOf,
						page.unmapped,
						(task) => page.catalogue.get(task)?.bound,
					)
				: null,
		[plan, handlersKey, page.lineOf, unmappedKey, page.catalogue],
	);

	if (page.planLoading)
		return (
			<div className="flex justify-center p-6">
				<Spinner />
			</div>
		);
	if (page.planError)
		return (
			<EmptyState
				className="py-8"
				title="The plan did not load"
				description={
					page.planError instanceof Error
						? page.planError.message
						: "The engine did not answer."
				}
			/>
		);
	if (!plan || !data || plan.nodes.length === 0)
		return (
			<EmptyState
				className="py-8"
				icon={<Workflow className="size-6" />}
				title="Nothing to draw yet"
				description="The plan appears once the steps name things the allowed functions can do."
			/>
		);

	const step = plan.nodes.find((n) => n.id === selected) ?? null;

	return (
		<div className="grid h-full min-h-0 gap-2.5 p-3.5 @[900px]:grid-cols-[1.7fr_1fr]">
			<div className="flex min-h-96 flex-col border">
				<div className="min-h-80 flex-1">
					<TaskFlowCanvas
						data={data}
						settings={skillFlowSettings}
						templates={skillFlowTemplates}
						initialDetail="cards"
						selectedId={selected}
						onOpenNode={(id) =>
							setSelected(plan.nodes.some((n) => n.id === id) ? id : null)
						}
					/>
				</div>
				<p className="flex items-center gap-1.5 border-t px-3 py-1.5 text-sm text-muted-foreground">
					<PencilLine className="size-3.5 shrink-0" />
					Drawn from the instructions, v{page.planVersion}. A run may replan
					within what this skill may use — the change shows on that run, never
					here.
				</p>
			</div>
			<div className="flex min-w-0 flex-col gap-2.5 overflow-y-auto">
				{step ? (
					<StepPanel
						page={page}
						plan={plan}
						step={step}
						onBack={() => setSelected(null)}
					/>
				) : (
					<>
						{[...new Set(page.unmapped)].map((span) => (
							<UnmappedCards key={span} page={page} span={span} />
						))}
						<FromTheInstructions
							page={page}
							plan={plan}
							onSelect={setSelected}
						/>
						<ThisFlow page={page} plan={plan} />
					</>
				)}
			</div>
		</div>
	);
}

/**
 * A line no allowed function does: what it says and why it cannot be drawn,
 * then its **Choices** — the same two as on Instructions, saved straight to
 * the draft and drawn again.
 */
function UnmappedCards({ page, span }: { page: SkillPage; span: string }) {
	const canBuild = useAccess().gate("build").allowed;
	const save = useSaveDraftMutation(
		page.username,
		page.graphSlug,
		page.skill.id,
	);
	const text = page.draft?.version.content ?? "";
	const line = page.lineOf(span);
	return (
		<>
			<RefusalCard
				label={`line ${line ?? "—"} can't be drawn · no function this skill may use does this`}
				remedy="Publishing waits until every line maps to a function the skill may use."
			>
				“{span}”
			</RefusalCard>
			<PanelSection
				card
				title="Choices"
				hint={line ? `line ${line}` : undefined}
			>
				<UnmappedChoices
					line={line}
					text={text}
					editable={page.hasDraft && !!page.draft && canBuild}
					busy={save.isPending || page.drawing}
					onRewrite={(n, next) =>
						save.mutate(
							{ content: replaceLine(text, n, next) },
							{ onSuccess: page.draw },
						)
					}
					note="Either choice saves the draft and draws the flow again."
				/>
			</PanelSection>
		</>
	);
}

/** One step's function as a row names it — a person's step reads as words. */
const stepName = (n: SkillPlaybookNode) =>
	n.form === "human" || !n.task ? null : n.task;

/**
 * One row per line the plan came from: a line's steps — several when it
 * inlined a plan — as one row, a handler, or a gap.
 */
function FromTheInstructions({
	page,
	plan,
	onSelect,
}: {
	page: SkillPage;
	plan: SkillPlaybookRead;
	onSelect: (id: string) => void;
}) {
	type Row = {
		key: string;
		line: number | null;
		text: string;
		kind: "step" | "handler" | "gap";
		/** A line's steps, each function once, with the first step that calls it. */
		steps?: { id: string; task: string | null }[];
	};
	const byLine = new Map<string, Row>();
	for (const n of plan.nodes) {
		const line = page.lineOf(n.source_span);
		const key = line != null ? `l${line}` : `n${n.id}`;
		const row = byLine.get(key) ?? {
			key,
			line,
			text: n.source_span ?? n.label,
			kind: "step" as const,
			steps: [],
		};
		const task = stepName(n);
		if (!row.steps?.some((s) => s.task === task))
			row.steps?.push({ id: n.id, task });
		byLine.set(key, row);
	}
	const rows: Row[] = [
		...byLine.values(),
		...page.handlers.map((h, i) => ({
			key: `h${i}`,
			line: page.lineOf(h.span),
			text: h.span,
			kind: "handler" as const,
		})),
		...[...new Set(page.unmapped)].map((s, i) => ({
			key: `u${i}`,
			line: page.lineOf(s),
			text: s,
			kind: "gap" as const,
		})),
	].sort((a, b) => (a.line ?? Infinity) - (b.line ?? Infinity));

	return (
		<PanelSection
			card
			title="From the instructions"
			hint={`${plan.nodes.length} step${plan.nodes.length === 1 ? "" : "s"} · ${page.handlers.length} handler${page.handlers.length === 1 ? "" : "s"}`}
		>
			<ul className="flex flex-col divide-y">
				{rows.map((r) => (
					<li key={r.key} className="flex items-start gap-2 py-1.5">
						<span className="w-14 shrink-0 font-mono text-sm text-muted-foreground">
							{r.line ? `line ${r.line}` : "no line"}
						</span>
						<span className="min-w-0 flex-1">{r.text}</span>
						{r.kind === "step" ? (
							<span className="flex max-w-[50%] shrink-0 flex-wrap justify-end gap-0.5">
								{r.steps?.map((s) =>
									s.task ? (
										<Button
											key={s.id}
											size="xs"
											variant="ghost"
											className="font-mono"
											onClick={() => onSelect(s.id)}
										>
											{s.task}
										</Button>
									) : (
										<Button
											key={s.id}
											size="xs"
											variant="ghost"
											className="text-muted-foreground"
											onClick={() => onSelect(s.id)}
										>
											a person
										</Button>
									),
								)}
							</span>
						) : r.kind === "handler" ? (
							<Badge size="xs" variant="soft" tone="warning">
								handler
							</Badge>
						) : (
							<Badge size="xs" variant="soft" tone="destructive">
								no function
							</Badge>
						)}
					</li>
				))}
			</ul>
		</PanelSection>
	);
}

/** The version it was drawn from, and the bounds it spends. */
function ThisFlow({
	page,
	plan,
}: {
	page: SkillPage;
	plan: SkillPlaybookRead;
}) {
	const bounds = [
		...new Set(
			plan.nodes
				.map((n) => page.catalogue.get(n.task)?.bound)
				.filter((b): b is string => !!b),
		),
	];
	// A plan inlined twice is composed once.
	const uses = [
		...new Map(plan.uses.map((u) => [`${u.key}@${u.version}`, u])).values(),
	];
	return (
		<PanelSection card title="This flow">
			<PropertyList labelWidth={110}>
				<PropertyRow label="Revision">
					{page.hasDraft
						? `drawn from the v${page.planVersion} draft`
						: `v${page.planVersion} · published`}
					{" · "}
					{plan.origin}
				</PropertyRow>
				<PropertyRow label="Bounds">
					<span className="flex flex-wrap gap-1.5">
						{bounds.length
							? bounds.map((b) => <BoundChip key={b} bound={b} />)
							: "—"}
					</span>
				</PropertyRow>
				<PropertyRow label="Every function">
					needed by the skill · allowed by a policy in IAM
				</PropertyRow>
				{uses.length ? (
					// Copied in when the plan was written; a newer library
					// version is said, never applied.
					<PropertyRow label="Composed">
						<span className="flex flex-wrap items-center gap-1.5">
							{uses.map((u) => (
								<span key={u.key} className="inline-flex items-center gap-1">
									<TypographyInlineCode>
										{u.key}@{u.version}
									</TypographyInlineCode>
									{u.latest_version > u.version ? (
										<Badge size="xs" variant="outline">
											v{u.latest_version} exists
										</Badge>
									) : null}
								</span>
							))}
						</span>
					</PropertyRow>
				) : null}
			</PropertyList>
		</PanelSection>
	);
}

/** One step: the line it came from, its bound, side effect, who needs it and its handler. */
function StepPanel({
	page,
	plan,
	step,
	onBack,
}: {
	page: SkillPage;
	plan: SkillPlaybookRead;
	step: SkillPlaybookNode;
	onBack: () => void;
}) {
	const i = plan.nodes.indexOf(step);
	const line = page.lineOf(step.source_span);
	const bound = page.catalogue.get(step.task)?.bound;
	const guards = page.handlers.filter((h) => guardedStep(plan, h) === step.id);
	return (
		<PanelSection
			card
			title={`Step ${i + 1} · ${stepName(step) ?? "a person does this"}`}
			action={
				<Button size="xs" variant="ghost" onClick={onBack}>
					<ArrowLeft /> Every line
				</Button>
			}
		>
			<PropertyList labelWidth={100}>
				<PropertyRow label="From">
					{line ? `line ${line} — ` : ""}“{step.source_span ?? step.label}”
				</PropertyRow>
				<PropertyRow label="Bound">
					{bound ? <BoundChip bound={bound} /> : step.layer}
				</PropertyRow>
				{step.task ? <SideEffect page={page} task={step.task} /> : null}
				<PropertyRow label="Needed by">this skill</PropertyRow>
				<PropertyRow label="Handler">
					{guards.length === 0 ? (
						"—"
					) : (
						<span className="flex flex-col text-warning">
							{guards.map((h) => (
								<span key={h.span}>
									{page.lineOf(h.span) ? `line ${page.lineOf(h.span)} — ` : ""}
									{h.span}
								</span>
							))}
						</span>
					)}
				</PropertyRow>
				{step.source_plan_key ? (
					<PropertyRow label="Inlined from">
						<TypographyInlineCode>{step.source_plan_key}</TypographyInlineCode>
					</PropertyRow>
				) : null}
			</PropertyList>
		</PanelSection>
	);
}

/** The function's declared side effect, when its manifest has one. */
function SideEffect({ page, task }: { page: SkillPage; task: string }) {
	const fn = useFunctionQuery(page.username, page.graphSlug, task);
	if (!fn.data?.side_effect) return null;
	return <PropertyRow label="Side effect">{fn.data.side_effect}</PropertyRow>;
}

/** The flow alone, for a frozen report panel that names a plan. */
export function PlanFlow({ plan }: { plan: SkillPlaybookRead }) {
	const data = useMemo(() => taskFlowFromPlan(plan), [plan]);
	return (
		<TaskFlowCanvas
			data={data}
			settings={taskFlowSettings}
			templates={taskFlowTemplates}
		/>
	);
}
