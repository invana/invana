/**
 * **New project** — a question to pursue, the words it is pursued in, its
 * first branch, who works on it and who can see it (projects.md PJ-02, board
 * `projects.new`).
 *
 * The type sets the project's words: what a branch, evidence, a verdict and a
 * decision are called. Three types can be made today; the others are drawn
 * and switched off, because the engine refuses them.
 *
 * **Who works on it.** The person making it is staffed by the engine, so is
 * not offered. The Graph's other members (by name) and its agents are one
 * checkbox list; everyone picked is staffed once the project exists — a person
 * by their `user_id`, an agent by its id. On a private project that list is
 * who can open it.
 *
 * Rules are not asked for here. A project's own rules are written on its
 * Details tab, once there is a project to bind them to.
 */

import { Checkbox, Input, Label, Textarea } from "@invana/forms";
import {
	Button,
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	SegmentedControl,
	ToggleGroup,
	ToggleGroupItem,
} from "@invana/ui";
import { useAuth, useMembersQuery } from "@invana-studio/core";
import { FormError } from "@invana-studio/ui";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { projectsApi } from "../api";
import { useProjectsSlots } from "../ProjectsSlots";
import { useProjectMutations } from "../queries";
import { LAUNCHED_TYPES, TYPES } from "../records/words";
import type { Project, ProjectType, Visibility } from "../types";

/** Who to staff: what `projectsApi.staff` takes. */
type Principal = { principal_kind: "user" | "agent"; principal_id: string };

const VISIBILITY: { value: Visibility; label: string }[] = [
	{ value: "graph", label: "Graph members" },
	{ value: "private", label: "Only the people on it" },
];

export function NewProjectDialog({
	open,
	onClose,
	username,
	graphSlug,
	onCreated,
}: {
	open: boolean;
	onClose: () => void;
	username: string;
	graphSlug: string;
	onCreated?: (project: Project) => void;
}) {
	const qc = useQueryClient();
	const { useAgents } = useProjectsSlots();
	const agents = (useAgents(username, graphSlug).data?.items ?? []).filter(
		(a) => a.status !== "archived",
	);
	const me = useAuth().user?.username;
	const members = (
		useMembersQuery({ username, graphSlug }).data?.items ?? []
	).filter((m) => m.username !== me);
	// One list, people first: a key is `user:<user_id>` or `agent:<id>`.
	const choices: { key: string; label: string; principal: Principal }[] = [
		...members.map((m) => ({
			key: `user:${m.user_id}`,
			label: m.first_name || m.username,
			principal: { principal_kind: "user" as const, principal_id: m.user_id },
		})),
		...agents.map((a) => ({
			key: `agent:${a.id}`,
			label: a.name,
			principal: { principal_kind: "agent" as const, principal_id: a.id },
		})),
	];
	const { create } = useProjectMutations(username, graphSlug);
	const [type, setType] = useState<ProjectType>("research");
	const [question, setQuestion] = useState("");
	const [name, setName] = useState("");
	const [objective, setObjective] = useState("");
	const [firstBranch, setFirstBranch] = useState("");
	const [staffed, setStaffed] = useState<Set<string>>(new Set());
	const [visibility, setVisibility] = useState<Visibility>("graph");
	const [error, setError] = useState<Error | null>(null);
	const [saving, setSaving] = useState(false);

	useEffect(() => {
		if (!open) return;
		setType("research");
		setQuestion("");
		setName("");
		setObjective("");
		setFirstBranch("");
		setStaffed(new Set());
		setVisibility("graph");
		setError(null);
	}, [open]);

	const title = name.trim() || question.trim().slice(0, 60).trim();

	const submit = async () => {
		if (!title) return;
		setSaving(true);
		setError(null);
		try {
			const project = await create.mutateAsync({
				name: title,
				type,
				question: question.trim(),
				description: objective.trim(),
				first_branch: firstBranch.trim() || null,
				visibility,
			});
			await Promise.all(
				choices
					.filter((c) => staffed.has(c.key))
					.map((c) =>
						projectsApi.staff(username, graphSlug, project.key, c.principal),
					),
			);
			qc.invalidateQueries({ queryKey: ["projects", username, graphSlug] });
			onCreated?.(project);
			onClose();
		} catch (e) {
			setError(e as Error);
		} finally {
			setSaving(false);
		}
	};

	return (
		<Dialog open={open} onOpenChange={(o) => !o && onClose()}>
			<DialogContent className="max-w-[720px]">
				<DialogHeader>
					<DialogTitle>New project</DialogTitle>
					<DialogDescription>
						A question to pursue and decide. Its type sets the words it is
						pursued in.
					</DialogDescription>
				</DialogHeader>
				<form
					id="new-project"
					className="flex flex-col gap-4"
					onSubmit={(e) => {
						e.preventDefault();
						void submit();
					}}
				>
					<div className="flex flex-col gap-1.5">
						<Label>Type</Label>
						<ToggleGroup
							type="single"
							variant="outline"
							value={type}
							onValueChange={(v) => v && setType(v as ProjectType)}
							className="grid grid-cols-3"
						>
							{TYPES.map((t) => {
								const launched = LAUNCHED_TYPES.includes(t.type);
								return (
									<ToggleGroupItem
										key={t.type}
										value={t.type}
										disabled={!launched}
										aria-label={t.label}
										className="h-auto flex-col items-start gap-0.5 px-3 py-2 text-left"
									>
										<span className="font-medium">{t.label}</span>
										<span className="text-sm text-muted-foreground">
											{launched ? t.words : "switches on when a team needs it"}
										</span>
									</ToggleGroupItem>
								);
							})}
						</ToggleGroup>
					</div>
					<div className="flex flex-col gap-1.5">
						<Label htmlFor="new-project-question">The question</Label>
						<Textarea
							id="new-project-question"
							rows={2}
							value={question}
							onChange={(e) => setQuestion(e.target.value)}
							placeholder="What this project sets out to decide"
						/>
					</div>
					<div className="grid grid-cols-2 gap-3">
						<div className="flex flex-col gap-1.5">
							<Label htmlFor="new-project-name">Name</Label>
							<Input
								id="new-project-name"
								value={name}
								onChange={(e) => setName(e.target.value)}
								placeholder={title || "The question's first words"}
							/>
						</div>
						<div className="flex flex-col gap-1.5">
							<Label htmlFor="new-project-branch">First branch</Label>
							<Input
								id="new-project-branch"
								value={firstBranch}
								onChange={(e) => setFirstBranch(e.target.value)}
								placeholder="The question, as asked"
							/>
						</div>
					</div>
					<div className="flex flex-col gap-1.5">
						<Label htmlFor="new-project-objective">Objective</Label>
						<Textarea
							id="new-project-objective"
							rows={2}
							value={objective}
							onChange={(e) => setObjective(e.target.value)}
							placeholder="What a good answer lets you do — the goal every agent on it plans from"
						/>
					</div>
					<div className="flex flex-col gap-1.5">
						<Label>People and agents</Label>
						<p className="text-sm text-muted-foreground">
							You are on it. Pick the people and agents who work on it too.
						</p>
						{choices.length ? (
							<div className="flex flex-wrap gap-x-4 gap-y-1.5">
								{choices.map((c) => (
									<Label
										key={c.key}
										className="flex items-center gap-1.5 font-normal"
									>
										<Checkbox
											checked={staffed.has(c.key)}
											onCheckedChange={(on) =>
												setStaffed((prev) => {
													const next = new Set(prev);
													if (on) next.add(c.key);
													else next.delete(c.key);
													return next;
												})
											}
										/>
										{c.label}
									</Label>
								))}
							</div>
						) : null}
					</div>
					<div className="flex flex-col gap-1.5">
						<Label>Who can see it</Label>
						<SegmentedControl
							options={VISIBILITY}
							value={visibility}
							onValueChange={(v) => setVisibility(v as Visibility)}
						/>
					</div>
					<FormError error={error} />
				</form>
				<DialogFooter>
					<Button variant="ghost" onClick={onClose}>
						Cancel
					</Button>
					<Button type="submit" form="new-project" disabled={!title || saving}>
						{saving ? "Creating…" : "Create project"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
