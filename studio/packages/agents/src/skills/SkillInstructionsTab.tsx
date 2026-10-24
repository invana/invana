/**
 * A skill › **Instructions** — the document, and what it resolves to.
 *
 * Left, `instructions.md` in an editor (Edit · Preview). Right, **Functions it
 * needs** — the plan's own functions, never a second list — and **Plan
 * preview**: the plan's steps with their bounds, each handler under the step it
 * guards. *Save* writes the draft and draws the plan again; while it draws the
 * preview says so and keeps the last plan.
 *
 * A line the draw could not map is flagged in the warning tone directly under
 * the editor, naming its line, with the choices the engine supports: a
 * question the planner asked is answered from its readings (one of them leaves
 * the step to a person); an unmapped line is either *left to a person* — the
 * line is written as a person's step, which the next draw keeps as one — or
 * *rewritten* in place. Publish waits until every line maps.
 *
 * The editor fills the page; the **console** — Tests · Evals · Problems · Log —
 * docks under it, full width, behind a resize handle, where a test run lands
 * while the person stays on the text it tests. Folding the console leaves its
 * tab strip and gives the editor the rest.
 *
 * A published skill with no draft reads its head text; *Edit instructions* in
 * the page head opens a draft.
 */

import { CodeBlock, MarkdownEditorBlock } from "@invana/editor";
import { Input } from "@invana/forms";
import {
	Alert,
	AlertDescription,
	AlertTitle,
	BoundChip,
	Button,
	Card,
	ClarifyCard,
	Eyebrow,
	RefusalCard,
	ResizableHandle,
	ResizablePanel,
	ResizablePanelGroup,
	SectionHeader,
	SegmentedControl,
	Spinner,
	TypographyInlineCode,
} from "@invana/ui";
import { ActButton, useAccess } from "@invana-studio/shell";
import { FormError, PanelSection } from "@invana-studio/ui";
import { ArrowRight, Save, TriangleAlert } from "lucide-react";
import { type ReactNode, useState } from "react";
import { AddFunctionsPicker } from "./AddFunctionsPicker";
import { type ConsoleTab, SkillConsole } from "./console/SkillConsole";
import { addFunctionLines, lineOf, replaceLine } from "./instructionsText";
import {
	useAnswerClarificationMutation,
	useSaveDraftMutation,
} from "./queries";
import { guardedStep } from "./taskFlowFromPlan";
import type { SkillClarification } from "./types";
import { planFunctions, type SkillPage } from "./useSkillPage";

const NOTHING_TO_DRAW =
	"Nothing to draw yet — the plan appears once the steps name things the allowed functions can do.";

export function SkillInstructionsTab({
	page,
	onOpenFlow,
}: {
	page: SkillPage;
	onOpenFlow: () => void;
}) {
	const { username, graphSlug, skill, draft } = page;
	const canBuild = useAccess().gate("build").allowed;
	const save = useSaveDraftMutation(username, graphSlug, skill.id);
	const answer = useAnswerClarificationMutation(username, graphSlug, skill.id);
	const [view, setView] = useState<"edit" | "preview">("edit");
	const [consoleTab, setConsoleTab] = useState<ConsoleTab>("tests");
	const [folded, setFolded] = useState(false);
	// The buffer is taken once per draft row, so a poll never overwrites typing.
	const [buffer, setBuffer] = useState<{ id: string; text: string } | null>(
		null,
	);
	const versionId = draft?.version.id ?? null;
	if (versionId && buffer?.id !== versionId)
		setBuffer({ id: versionId, text: draft?.version.content ?? "" });

	if (page.draftLoading)
		return (
			<div className="flex justify-center p-6">
				<Spinner />
			</div>
		);

	const editable = page.hasDraft && !!draft && canBuild;
	const text = page.hasDraft ? (buffer?.text ?? "") : skill.content;
	const dirty = !!draft && text !== draft.version.content;
	const setText = (next: string) =>
		versionId && setBuffer({ id: versionId, text: next });

	const saveAndDraw = () => {
		if (dirty) save.mutate({ content: text }, { onSuccess: page.draw });
		else page.draw();
	};

	const console_ = (
		<SkillConsole
			page={page}
			tab={consoleTab}
			onTabChange={setConsoleTab}
			folded={folded}
			onFoldedChange={setFolded}
		/>
	);

	return (
		<div className="flex h-full min-h-0 flex-col">
			<ResizablePanelGroup orientation="vertical" className="min-h-0 flex-1">
				<ResizablePanel id="document" minSize={240}>
					<div className="flex h-full min-h-0 flex-col gap-2.5 overflow-y-auto p-3.5">
						<FormError
							error={
								(page.draftError ??
									save.error ??
									page.drawError) as Error | null
							}
						/>
						<div className="grid min-h-0 flex-1 gap-2.5 @[900px]:grid-cols-[1.7fr_1fr] @[900px]:grid-rows-[minmax(0,1fr)]">
							<div className="flex min-h-0 min-w-0 flex-col gap-2.5">
								<EditorCard
									title="instructions.md · Markdown"
									hint={
										!page.hasDraft
											? `v${skill.version} · published · read-only`
											: dirty
												? "editing · not saved"
												: "saved on the draft"
									}
									action={
										<span className="flex items-center gap-1.5">
											<SegmentedControl
												size="xs"
												aria-label="Editor view"
												value={view}
												onValueChange={(v) => setView(v as "edit" | "preview")}
												options={[
													{ value: "edit", label: "Edit" },
													{ value: "preview", label: "Preview" },
												]}
											/>
											{page.hasDraft ? (
												<ActButton
													area="build"
													size="xs"
													disabled={
														!draft ||
														save.isPending ||
														page.drawing ||
														(!dirty && draft.drawn)
													}
													onClick={saveAndDraw}
												>
													<Save />
													{save.isPending
														? "Saving…"
														: page.drawing
															? "Drawing…"
															: dirty
																? "Save"
																: "Draw"}
												</ActButton>
											) : null}
										</span>
									}
								>
									{view === "edit" && editable ? (
										<MarkdownEditorBlock
											aria-label="instructions.md"
											value={text}
											onChange={setText}
											version={`v${page.planVersion}${dirty ? " · editing" : ""}`}
											className="min-h-64 flex-1 overflow-y-auto"
										/>
									) : (
										<div className="min-h-64 flex-1 overflow-y-auto">
											<CodeBlock
												value={text}
												language="plain"
												showLineNumbers
											/>
										</div>
									)}
								</EditorCard>

								<LineFlags
									page={page}
									text={text}
									editable={editable}
									onRewrite={(n, line) => setText(replaceLine(text, n, line))}
									answering={answer.isPending}
									onAnswer={(c, value) =>
										answer.mutate(
											{ clarificationId: c.id, answer: value },
											{ onSuccess: page.draw },
										)
									}
								/>
							</div>

							<div className="flex min-h-0 min-w-0 flex-col gap-2.5 overflow-y-auto">
								<FunctionsNeededCard
									page={page}
									canAdd={editable}
									onAdd={(fns) => setText(addFunctionLines(text, fns))}
								/>
								<PlanPreviewCard
									page={page}
									text={text}
									onOpenFlow={onOpenFlow}
								/>
							</div>
						</div>
					</div>
				</ResizablePanel>
				{folded ? null : (
					<>
						<ResizableHandle withHandle />
						<ResizablePanel id="console" defaultSize="32" minSize={120}>
							{console_}
						</ResizablePanel>
					</>
				)}
			</ResizablePanelGroup>
			{folded ? console_ : null}
		</div>
	);
}

/**
 * The document's card: the eyebrow head of a page section, with a body that
 * fills the height it is given so the editor takes the page.
 */
function EditorCard({
	title,
	hint,
	action,
	children,
}: {
	title: ReactNode;
	hint: ReactNode;
	action: ReactNode;
	children: ReactNode;
}) {
	return (
		<Card className="flex min-h-0 flex-1 flex-col rounded-none shadow-none">
			<SectionHeader
				title={
					<span className="flex min-w-0 items-baseline gap-2">
						<Eyebrow className="shrink-0">{title}</Eyebrow>
						<span className="min-w-0 truncate font-normal text-sm text-muted-foreground">
							{hint}
						</span>
					</span>
				}
				actions={action}
			/>
			<div className="flex min-h-0 flex-1 flex-col px-3 py-2">{children}</div>
		</Card>
	);
}

/**
 * The draw's own refusals, directly under the editor, each naming its line: a
 * question with its readings as buttons, and an unmapped line with *Leave it to
 * a person* · *Rewrite the line*.
 */
function LineFlags({
	page,
	text,
	editable,
	onRewrite,
	answering,
	onAnswer,
}: {
	page: SkillPage;
	text: string;
	editable: boolean;
	onRewrite: (line: number, next: string) => void;
	answering: boolean;
	onAnswer: (c: SkillClarification, answer: string) => void;
}) {
	const open = page.draft?.open_clarification ?? null;
	if (!open && page.unmapped.length === 0) return null;
	return (
		<div className="flex flex-col gap-2">
			{open ? (
				<ClarifyCard
					step={`line ${lineOf(text, open.span) ?? "—"} · “${open.span}”`}
					question={open.question}
					options={[
						...open.options.map((o) => ({
							value: o.step_key,
							label: o.step_key,
							detail: o.why || o.label,
							disabled: answering || !editable,
						})),
						{
							value: "none",
							label: "Leave it to a person",
							detail: "a person does this step",
							disabled: answering || !editable,
						},
					]}
					onSelect={(v) => onAnswer(open, v)}
				/>
			) : null}
			{page.unmapped.map((span) => (
				<UnmappedLine
					key={span}
					span={span}
					line={lineOf(text, span)}
					text={text}
					editable={editable}
					onRewrite={onRewrite}
				/>
			))}
		</div>
	);
}

function UnmappedLine({
	span,
	line,
	text,
	editable,
	onRewrite,
}: {
	span: string;
	line: number | null;
	text: string;
	editable: boolean;
	onRewrite: (line: number, next: string) => void;
}) {
	return (
		<Alert tone="warning">
			<TriangleAlert className="size-4" />
			<AlertTitle>
				line {line ?? "—"} · no function this skill may use does this
			</AlertTitle>
			<AlertDescription className="flex flex-col gap-2">
				<span className="font-mono text-sm">“{span}”</span>
				<UnmappedChoices
					line={line}
					text={text}
					editable={editable}
					onRewrite={onRewrite}
					note="Leaving it to a person writes the line as a person's step; save and the plan draws it as one."
				/>
			</AlertDescription>
		</Alert>
	);
}

/**
 * What a person can do about a line no allowed function does: *Leave it to a
 * person* writes it as a person's step, *Rewrite the line* edits it in place.
 * `onRewrite` takes the line's new text; where it lands — the editor's buffer
 * or a saved draft — is the caller's.
 */
export function UnmappedChoices({
	line,
	text,
	editable,
	onRewrite,
	note,
	busy = false,
}: {
	line: number | null;
	text: string;
	editable: boolean;
	onRewrite: (line: number, next: string) => void;
	note: string;
	busy?: boolean;
}) {
	const current = line ? (text.split("\n")[line - 1] ?? "") : "";
	const [draft, setDraft] = useState<string | null>(null);
	const person = toPersonStep(current);
	if (!line)
		return (
			<span className="text-sm text-muted-foreground">
				The line no longer reads in the text — save to draw again.
			</span>
		);
	if (!editable) return null;
	if (draft === null)
		return (
			<span className="flex flex-col gap-1.5">
				<span className="flex flex-wrap items-center gap-1.5">
					<Button
						size="xs"
						variant="outline"
						disabled={busy || person === current}
						onClick={() => onRewrite(line, person)}
					>
						Leave it to a person
					</Button>
					<Button
						size="xs"
						variant="outline"
						disabled={busy}
						onClick={() => setDraft(current)}
					>
						Rewrite the line
					</Button>
				</span>
				<span className="text-sm text-muted-foreground">{note}</span>
			</span>
		);
	return (
		<span className="flex w-full items-center gap-1">
			<Input
				aria-label={`Line ${line}`}
				value={draft}
				className="font-mono"
				onChange={(e) => setDraft(e.target.value)}
			/>
			<Button
				size="xs"
				disabled={busy}
				onClick={() => {
					onRewrite(line, draft);
					setDraft(null);
				}}
			>
				Replace
			</Button>
			<Button size="xs" variant="ghost" onClick={() => setDraft(null)}>
				Cancel
			</Button>
		</span>
	);
}

const PERSON_STEP = "A person does this: ";

/**
 * The line as an explicit person's step, its list marker kept — a sentence no
 * allowed function can do and that names a person to do it draws as a
 * person's step.
 */
function toPersonStep(line: string): string {
	const [, marker = "", rest = ""] =
		/^(\s*(?:(?:[-*+]|\d+[.)])\s+)?)(.*)$/.exec(line) ?? [];
	if (!rest.trim() || rest.startsWith(PERSON_STEP)) return line;
	return `${marker}${PERSON_STEP}${rest}`;
}

/** The functions the plan calls, each with its bound; *Add functions* writes a need. */
function FunctionsNeededCard({
	page,
	canAdd,
	onAdd,
}: {
	page: SkillPage;
	canAdd: boolean;
	onAdd: (functions: string[]) => void;
}) {
	const fns = planFunctions(page.plan);
	const bounds = new Set(
		fns.map((f) => page.catalogue.get(f)?.bound).filter(Boolean),
	);
	return (
		<PanelSection
			card
			title="Functions it needs"
			hint="a policy in IAM must allow them"
		>
			<div className="flex flex-col gap-2">
				{fns.length === 0 ? (
					<p className="text-muted-foreground">
						No functions yet. Add some, or write steps that name what the skill
						does.
					</p>
				) : (
					<ul className="flex flex-col gap-1">
						{fns.map((f) => {
							const bound = page.catalogue.get(f)?.bound;
							return (
								<li key={f} className="flex items-center gap-2">
									<TypographyInlineCode>{f}</TypographyInlineCode>
									{bound ? <BoundChip bound={bound} /> : null}
								</li>
							);
						})}
					</ul>
				)}
				<div className="flex items-center gap-2">
					{canAdd ? (
						<AddFunctionsPicker
							entries={page.catalogueEntries}
							named={fns}
							onAdd={onAdd}
						/>
					) : null}
					{fns.length ? (
						<span className="ms-auto text-sm text-muted-foreground">
							{fns.length} · {bounds.size} bound{bounds.size === 1 ? "" : "s"}
						</span>
					) : null}
				</div>
			</div>
		</PanelSection>
	);
}

/** The plan's steps with their bounds, each handler under the step it guards. */
function PlanPreviewCard({
	page,
	text,
	onOpenFlow,
}: {
	page: SkillPage;
	text: string;
	onOpenFlow: () => void;
}) {
	const { plan, draft } = page;
	const nodes = plan?.nodes ?? [];
	const firstUnmapped = page.unmapped[0];
	const refusal = draft?.refusal ?? null;

	return (
		<PanelSection
			card
			title="Plan preview"
			hint={
				page.drawing
					? "Drawing…"
					: !nodes.length
						? undefined
						: firstUnmapped || refusal || (draft && !draft.drawn)
							? "from an earlier text"
							: "drawn from the text"
			}
		>
			<div className="flex flex-col gap-2">
				{firstUnmapped ? (
					<Alert tone="warning">
						<TriangleAlert className="size-4" />
						<AlertDescription>
							Line {lineOf(text, firstUnmapped) ?? "—"} needs a function this
							skill may not use. The steps below are from an earlier text; the
							plan draws again once every line maps to an allowed function.
						</AlertDescription>
					</Alert>
				) : null}
				{refusal && !page.drawing ? (
					<RefusalCard
						label="refused · the plan does not hold together"
						remedy="Rewrite the line it names and save — the plan you had is untouched."
					>
						<ul>
							{refusal.reasons.map((r) => (
								<li key={r}>{r}</li>
							))}
						</ul>
					</RefusalCard>
				) : null}
				{page.planLoading ? (
					<Spinner />
				) : nodes.length === 0 ? (
					<p className="text-muted-foreground">
						{page.drawing ? "Drawing…" : NOTHING_TO_DRAW}
					</p>
				) : (
					<ol className="flex flex-col divide-y">
						{nodes.map((node, i) => {
							const bound = page.catalogue.get(node.task)?.bound;
							const guards = page.handlers.filter(
								(h) => plan && guardedStep(plan, h) === node.id,
							);
							return (
								<li key={node.id} className="flex flex-col gap-1 py-1.5">
									<span className="flex items-center gap-2">
										<span className="w-4 text-muted-foreground tabular-nums">
											{i + 1}
										</span>
										{node.form === "human" || !node.task ? (
											<span className="text-muted-foreground">
												a person does this
											</span>
										) : (
											<TypographyInlineCode>{node.task}</TypographyInlineCode>
										)}
										<span className="ms-auto">
											{bound ? <BoundChip bound={bound} /> : null}
										</span>
									</span>
									{guards.map((h) => (
										<span key={h.span} className="ps-6 text-sm text-warning">
											↳ {h.span}
										</span>
									))}
								</li>
							);
						})}
					</ol>
				)}
				<div className="flex items-center gap-2 text-sm text-muted-foreground">
					<span>
						{page.drawing
							? "the last plan stays until this one lands"
							: firstUnmapped
								? `waits on line ${lineOf(text, firstUnmapped) ?? "—"} · Publish waits`
								: refusal
									? "refused · the plan above is the last that drew"
									: draft && !draft.drawn
										? "regenerates when you save"
										: page.hasDraft
											? `up to date · v${page.planVersion} draft`
											: `v${page.skill.version} · published`}
					</span>
					{nodes.length ? (
						<Button
							size="xs"
							variant="link"
							className="ms-auto"
							onClick={onOpenFlow}
						>
							Open its Flow <ArrowRight />
						</Button>
					) : null}
				</div>
			</div>
		</PanelSection>
	);
}
