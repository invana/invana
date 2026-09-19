/**
 * Skills as a **work surface** (`Agents at Work` hi-fi, *Skills · hi-fi*).
 *
 * A skill used to live only in Settings, as a form. That was the wrong shape
 * for the question people actually bring to one — *is this prose doing
 * anything?* — because a form can show what a skill **says** and nothing about
 * what it **did**. This panel answers both, and the second half is the reason
 * it exists: `offered 41× · reported 29×`, then the steps behind those numbers.
 *
 * ## `offered` and `reported` are not the same claim
 *
 * This distinction is the whole design of the usage list, and it is a promise
 * about honesty rather than a UI nicety (docs/for-developers/modules/work/spec.md):
 *
 * | Badge | What it means | How we know |
 * |---|---|---|
 * | **offered** | this skill's prose was in the prompt | a fact the engine recorded when it built the prompt |
 * | **reported** | the model says it applied it | the model's own claim, and nothing more |
 *
 * Nothing here ever says *used*. There is no way to verify that a model
 * followed prose, so a word that implies we did would be a lie told in a badge.
 * The legend under the list says the same thing in the user's words, because a
 * distinction nobody explains is one everybody collapses.
 *
 * ## The canvas keeps whatever it was showing
 *
 * A skill is a setting that hangs over the work, not a thing with a shape — so
 * this panel opens beside the canvas already on screen rather than replacing
 * it. That is why it takes no canvas of its own.
 */

import {
	useCreateSkillMutation,
	useDeleteSkillMutation,
	useSkillsQuery,
	useUpdateSkillMutation,
} from "@/hooks/queries/useSkills";
import { useSkillUsageQuery } from "@/hooks/queries/useWork";
import {
	DetailPlaceholder,
	DetailStatus,
} from "@/pages/graphs-detail/shared/DetailRows";
import { ListPanelChrome } from "@/pages/graphs-detail/shared/ListPanel";
import { WorkRow } from "@/pages/graphs-detail/shared/WorkRow";
import type { Skill } from "@/types/skills";
import { PanelSection } from "@/ui/PanelSection";
import { PanelStatusBar, StatusCrumb } from "@/ui/PanelStatusBar";
import { PrincipalChip } from "@/ui/PrincipalChip";
import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbList,
	BreadcrumbPage,
	BreadcrumbSeparator,
	Button,
	CardFooter,
	Spinner,
	StatusDot,
} from "@invana/ui";
import { Pencil, Plus, Trash2, Wand2 } from "lucide-react";
import { useState } from "react";

interface Props {
	username: string;
	graphSlug: string;
	onClose?: () => void;
	selectedSkillId: string | null;
	onSelectSkill: (id: string | null) => void;
	onOpenAgent?: (agentId: string) => void;
}

export function SkillsPanel({
	username,
	graphSlug,
	onClose,
	selectedSkillId,
	onSelectSkill,
	onOpenAgent,
}: Props) {
	const [editing, setEditing] = useState<"new" | string | null>(null);

	const skills = useSkillsQuery(username, graphSlug);
	const remove = useDeleteSkillMutation(username, graphSlug);

	const items = skills.data?.items ?? [];
	const selected = items.find((s) => s.id === selectedSkillId) ?? null;

	return (
		<ListPanelChrome
			title={
				selected ? (
					<Breadcrumb>
						<BreadcrumbList className="gap-1 font-semibold sm:gap-1">
							<BreadcrumbItem>Skills</BreadcrumbItem>
							<BreadcrumbSeparator />
							<BreadcrumbItem className="min-w-0">
								<BreadcrumbPage className="truncate font-semibold">
									{selected.name}
								</BreadcrumbPage>
							</BreadcrumbItem>
						</BreadcrumbList>
					</Breadcrumb>
				) : (
					"Skills"
				)
			}
			icon={Wand2}
			onRefresh={() => skills.refetch()}
			isRefreshing={skills.isFetching}
			searchable
			searchLabel="Search skills"
			listControls={selected === null && editing === null}
			onClose={onClose}
			leadingActions={[
				{
					key: "new",
					name: "New skill",
					icon: Plus,
					onClick: () => {
						onSelectSkill(null);
						setEditing("new");
					},
				},
			]}
		>
			{({ search }) => {
				if (editing) {
					const existing = editing === "new" ? null : (selected ?? null);
					return (
						<SkillForm
							username={username}
							graphSlug={graphSlug}
							existing={existing}
							onDone={(id) => {
								setEditing(null);
								if (id) onSelectSkill(id);
							}}
						/>
					);
				}

				if (selected) {
					return (
						<SkillDetail
							username={username}
							graphSlug={graphSlug}
							skill={selected}
							total={items.length}
							onBack={() => onSelectSkill(null)}
							onEdit={() => setEditing(selected.id)}
							onDelete={() => {
								remove.mutate(selected.id);
								onSelectSkill(null);
							}}
							onOpenAgent={onOpenAgent}
						/>
					);
				}

				const rows = items.filter((s) =>
					s.name.toLowerCase().includes(search.toLowerCase()),
				);
				return (
					<div className="flex h-full min-h-0 flex-col">
						<div className="flex-1 overflow-y-auto">
							{skills.isLoading ? (
								<div className="p-4">
									<Spinner />
								</div>
							) : rows.length === 0 ? (
								<p className="p-4 text-sm text-muted-foreground">
									No skills yet. A skill is prose an agent is offered — what
									your data means, and which path through it to prefer.
								</p>
							) : (
								rows.map((skill) => (
									<WorkRow
										key={skill.id}
										onClick={() => onSelectSkill(skill.id)}
										tone={skill.content ? "info" : "muted"}
										title={skill.name}
										subtitle={
											<span className="truncate">
												{skill.description || "no description"}
											</span>
										}
									/>
								))
							)}
						</div>
						<PanelStatusBar
							left={
								<StatusCrumb active>All skills ({items.length})</StatusCrumb>
							}
							right="the canvas stays as it was"
						/>
					</div>
				);
			}}
		</ListPanelChrome>
	);
}

function SkillDetail({
	username,
	graphSlug,
	skill,
	total,
	onBack,
	onEdit,
	onDelete,
	onOpenAgent,
}: {
	username: string;
	graphSlug: string;
	skill: Skill;
	total: number;
	onBack: () => void;
	onEdit: () => void;
	onDelete: () => void;
	onOpenAgent?: (id: string) => void;
}) {
	const usage = useSkillUsageQuery(username, graphSlug, skill.id);
	const steps = usage.data?.recent_steps ?? [];
	const offered = steps.length;
	const reported = steps.filter((s) => s.reported).length;

	return (
		<div className="flex h-full min-h-0 flex-col">
			<div className="flex items-center gap-2 border-b px-3 py-1.5">
				<button
					type="button"
					onClick={onBack}
					className="shrink-0 text-sm text-muted-foreground hover:text-foreground"
				>
					← Skills
				</button>
			</div>

			<div className="flex shrink-0 items-center gap-2 px-4 pb-1 pt-2.5 text-sm">
				<DetailStatus>skill</DetailStatus>
				<span className="truncate text-muted-foreground">
					updated {new Date(skill.updated_at).toLocaleDateString()}
					{offered ? ` · offered ${offered}× · reported ${reported}×` : ""}
				</span>
			</div>

			<div className="min-h-0 flex-1 overflow-y-auto">
				<PanelSection title="Description">
					<p className="text-sm text-foreground">
						{skill.description || (
							<span className="text-muted-foreground">
								No description. This is the one line an agent sees when deciding
								whether the skill is relevant.
							</span>
						)}
					</p>
				</PanelSection>

				<PanelSection title="When to use">
					<p className="text-sm text-foreground">
						{skill.when_to_use || (
							<span className="text-muted-foreground">
								Not set — the skill is offered on every ask.
							</span>
						)}
					</p>
				</PanelSection>

				<PanelSection
					title="Content"
					action={
						<button
							type="button"
							onClick={onEdit}
							className="text-sm text-muted-foreground hover:text-foreground"
						>
							edit
						</button>
					}
				>
					<pre className="max-h-52 overflow-auto whitespace-pre-wrap rounded-sm bg-muted/50 px-2.5 py-2 font-mono text-sm text-foreground">
						{skill.content || "(empty)"}
					</pre>
				</PanelSection>

				<PanelSection
					title="Used by"
					hint="an agent that binds every skill sees this one too"
				>
					{usage.isLoading ? (
						<Spinner />
					) : usage.data?.used_by.length ? (
						<div className="flex flex-wrap gap-1.5">
							{usage.data.used_by.map((agent) => (
								<PrincipalChip
									key={agent.id}
									name={agent.name}
									kind="agent"
									muted={agent.status === "retired"}
									onClick={
										onOpenAgent ? () => onOpenAgent(agent.id) : undefined
									}
								/>
							))}
						</div>
					) : (
						<p className="text-sm text-muted-foreground">
							No agent binds this skill yet.
						</p>
					)}
				</PanelSection>

				<PanelSection
					title="Recent steps"
					action={
						<span className="flex items-center gap-1">
							<DetailStatus>offered</DetailStatus>
							<DetailStatus tone="success">reported</DetailStatus>
						</span>
					}
				>
					{usage.isLoading ? (
						<Spinner />
					) : steps.length === 0 ? (
						<p className="text-sm text-muted-foreground">
							This skill has never been put in a prompt.
						</p>
					) : (
						<div className="space-y-px">
							{steps.map((step) => (
								<div
									key={`${step.run_id}:${step.step_id}`}
									className="flex items-center gap-2 rounded-sm px-1.5 py-1 text-sm hover:bg-accent/50"
								>
									<StatusDot
										tone={step.reported ? "success" : "muted"}
										label={step.reported ? "reported" : "offered"}
									/>
									<span className="shrink-0 font-medium text-foreground">
										{step.label}
									</span>
									<span className="min-w-0 flex-1 truncate text-muted-foreground">
										{step.task_key}
									</span>
									<span className="shrink-0 text-muted-foreground">
										{step.reported ? "reported" : "offered"}
									</span>
								</div>
							))}
						</div>
					)}
					{/*
					 * The legend is not optional copy. `offered` and `reported` are two
					 * different kinds of claim, and a reader who collapses them will
					 * believe we verified something we cannot verify.
					 */}
					<p className="mt-2 text-sm text-muted-foreground">
						<span className="font-medium text-foreground">offered</span> = in
						the prompt (a fact) ·{" "}
						<span className="font-medium text-foreground">reported</span> = the
						model says it applied it
					</p>
				</PanelSection>
			</div>

			<CardFooter className="shrink-0 flex-wrap gap-2 border-t">
				<Button size="sm" onClick={onEdit}>
					<Pencil /> Edit
				</Button>
				<span className="flex-1" />
				<Button size="sm" variant="ghost" onClick={onDelete}>
					<Trash2 /> Delete
				</Button>
			</CardFooter>

			<PanelStatusBar
				left={
					<>
						<StatusCrumb active>Skill</StatusCrumb>
						<StatusCrumb onClick={onBack}>All skills ({total})</StatusCrumb>
					</>
				}
			/>
		</div>
	);
}

/**
 * Focus the field the moment it appears — the form only exists because the user
 * just asked for it, so putting the caret in it completes that gesture.
 */
function focusOnMount(el: HTMLInputElement | null) {
	el?.focus();
}

function SkillForm({
	username,
	graphSlug,
	existing,
	onDone,
}: {
	username: string;
	graphSlug: string;
	existing: Skill | null;
	onDone: (id?: string) => void;
}) {
	const [name, setName] = useState(existing?.name ?? "");
	const [description, setDescription] = useState(existing?.description ?? "");
	const [whenToUse, setWhenToUse] = useState(existing?.when_to_use ?? "");
	const [content, setContent] = useState(existing?.content ?? "");

	const create = useCreateSkillMutation(username, graphSlug);
	const update = useUpdateSkillMutation(username, graphSlug);
	const pending = create.isPending || update.isPending;

	const submit = (e: React.FormEvent) => {
		e.preventDefault();
		if (!name.trim()) return;
		const data = {
			name: name.trim(),
			description: description.trim(),
			when_to_use: whenToUse.trim(),
			content,
		};
		if (existing)
			update.mutate(
				{ id: existing.id, data },
				{ onSuccess: () => onDone(existing.id) },
			);
		else create.mutate(data, { onSuccess: (skill) => onDone(skill.id) });
	};

	return (
		<form onSubmit={submit} className="flex h-full min-h-0 flex-col">
			<div className="flex items-center gap-2 border-b px-3 py-1.5">
				<button
					type="button"
					onClick={() => onDone()}
					className="shrink-0 text-sm text-muted-foreground hover:text-foreground"
				>
					← Skills
				</button>
				<span className="truncate text-sm font-medium">
					{existing ? existing.name : "New skill"}
				</span>
			</div>

			<div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto px-3 py-2.5">
				<label className="block text-sm text-muted-foreground">
					Name
					<input
						ref={focusOnMount}
						value={name}
						onChange={(e) => setName(e.target.value)}
						placeholder="supplier-taxonomy"
						className="mt-1 w-full rounded-sm border bg-background px-2 py-1.5 font-mono text-sm text-foreground"
					/>
				</label>
				<label className="block text-sm text-muted-foreground">
					Description
					<input
						value={description}
						onChange={(e) => setDescription(e.target.value)}
						placeholder="How suppliers, parts and regions relate in this graph."
						className="mt-1 w-full rounded-sm border bg-background px-2 py-1.5 text-sm text-foreground"
					/>
				</label>
				<label className="block text-sm text-muted-foreground">
					When to use
					<input
						value={whenToUse}
						onChange={(e) => setWhenToUse(e.target.value)}
						placeholder="Any question that mentions suppliers, sourcing or parts."
						className="mt-1 w-full rounded-sm border bg-background px-2 py-1.5 text-sm text-foreground"
					/>
				</label>
				<label className="block text-sm text-muted-foreground">
					Content
					<textarea
						value={content}
						onChange={(e) => setContent(e.target.value)}
						rows={12}
						placeholder={"## Supplier taxonomy\n- A Supplier SUPPLIES a Part…"}
						className="mt-1 w-full resize-y rounded-sm border bg-background px-2 py-1.5 font-mono text-sm text-foreground"
					/>
				</label>
			</div>

			<div className="flex shrink-0 items-center gap-1.5 border-t px-2 py-1.5">
				<Button
					type="submit"
					size="sm"
					className="h-7 text-sm"
					disabled={pending || !name.trim()}
				>
					{pending ? "Saving…" : existing ? "Save" : "Create"}
				</Button>
				<Button
					type="button"
					size="sm"
					variant="ghost"
					className="h-7 text-sm"
					onClick={() => onDone()}
				>
					Cancel
				</Button>
			</div>
		</form>
	);
}

export { DetailPlaceholder };
