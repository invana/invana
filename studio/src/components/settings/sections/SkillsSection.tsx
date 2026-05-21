import { Button, Input, Label, Skeleton, Textarea } from "@invana/ui";
import { Plus, Trash2, Wand2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
	useCreateSkillMutation,
	useDeleteSkillMutation,
	useSkillsQuery,
	useUpdateSkillMutation,
} from "../../../hooks/queries/useSkills";
import type { Skill, SkillCreate } from "../../../types/skills";
import { FormError } from "../../forms/FormError";

interface Props {
	username: string;
	graphSlug: string;
}

export function SkillsSection({ username, graphSlug }: Props) {
	const { data, isLoading } = useSkillsQuery(username, graphSlug);
	const [editing, setEditing] = useState<"new" | Skill | null>(null);

	if (isLoading) {
		return (
			<div className="space-y-3">
				<Skeleton className="h-12 w-full" />
				<Skeleton className="h-12 w-full" />
			</div>
		);
	}

	if (editing) {
		return (
			<SkillForm
				username={username}
				graphSlug={graphSlug}
				existing={editing === "new" ? null : editing}
				onDone={() => setEditing(null)}
			/>
		);
	}

	const items = data?.items ?? [];

	return (
		<div className="space-y-4">
			<div className="flex items-center justify-between">
				<p className="text-muted-foreground">
					Capabilities the Graph's agents can apply.
				</p>
				<Button onClick={() => setEditing("new")}>
					<Plus className="w-4 h-4 mr-1" />
					Add skill
				</Button>
			</div>

			{items.length === 0 ? (
				<div className="border border-border rounded-lg p-8 flex flex-col items-center gap-3 text-center">
					<Wand2 className="w-8 h-8 text-muted-foreground opacity-50" />
					<p className="text-muted-foreground">
						No skills yet. Add one to describe what your agents can do.
					</p>
				</div>
			) : (
				<div className="border border-border rounded-lg divide-y divide-border">
					{items.map((s) => (
						<SkillRow
							key={s.id}
							username={username}
							graphSlug={graphSlug}
							skill={s}
							onEdit={() => setEditing(s)}
						/>
					))}
				</div>
			)}
		</div>
	);
}

function SkillRow({
	username,
	graphSlug,
	skill,
	onEdit,
}: {
	username: string;
	graphSlug: string;
	skill: Skill;
	onEdit: () => void;
}) {
	const remove = useDeleteSkillMutation(username, graphSlug);
	return (
		<div className="flex items-start gap-4 px-4 py-3">
			<div className="flex-1 min-w-0">
				<p className="font-medium">{skill.name}</p>
				{skill.description && (
					<p className="text-muted-foreground mt-0.5 line-clamp-2">
						{skill.description}
					</p>
				)}
			</div>
			<div className="flex items-center gap-1 shrink-0">
				<Button variant="ghost" size="sm" onClick={onEdit}>
					Edit
				</Button>
				<Button
					variant="ghost"
					size="icon"
					className="h-8 w-8"
					disabled={remove.isPending}
					onClick={() => {
						if (!confirm(`Delete skill "${skill.name}"?`)) return;
						remove.mutate(skill.id, {
							onError: (err) => toast.error(err.message),
							onSuccess: () => toast.success("Skill deleted"),
						});
					}}
				>
					<Trash2 className="w-4 h-4" />
				</Button>
			</div>
		</div>
	);
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
	onDone: () => void;
}) {
	const isEdit = !!existing;
	const create = useCreateSkillMutation(username, graphSlug);
	const update = useUpdateSkillMutation(username, graphSlug);

	const [name, setName] = useState(existing?.name ?? "");
	const [description, setDescription] = useState(existing?.description ?? "");
	const [content, setContent] = useState(existing?.content ?? "");
	const [whenToUse, setWhenToUse] = useState(existing?.when_to_use ?? "");

	const formValid = !!name.trim();
	const isSubmitting = create.isPending || update.isPending;

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		if (!formValid) return;
		const payload: SkillCreate = {
			name: name.trim(),
			description,
			content,
			when_to_use: whenToUse,
		};
		if (isEdit && existing) {
			update.mutate(
				{ id: existing.id, data: payload },
				{
					onSuccess: () => {
						toast.success("Skill saved");
						onDone();
					},
					onError: (err) => toast.error(err.message),
				},
			);
		} else {
			create.mutate(payload, {
				onSuccess: () => {
					toast.success("Skill added");
					onDone();
				},
				onError: (err) => toast.error(err.message),
			});
		}
	};

	return (
		<form onSubmit={handleSubmit} className="space-y-5" noValidate>
			<div className="space-y-1.5">
				<Label htmlFor="skill-name">
					Name <span className="text-destructive">*</span>
				</Label>
				<Input
					id="skill-name"
					placeholder="entity-resolution"
					value={name}
					onChange={(e) => setName(e.target.value)}
					maxLength={255}
				/>
			</div>
			<div className="space-y-1.5">
				<Label htmlFor="skill-description">Description</Label>
				<Textarea
					id="skill-description"
					placeholder="One-line summary of what this skill does."
					rows={2}
					value={description}
					onChange={(e) => setDescription(e.target.value)}
				/>
			</div>
			<div className="space-y-1.5">
				<Label htmlFor="skill-content">Content (markdown)</Label>
				<Textarea
					id="skill-content"
					placeholder="Step-by-step instructions, examples, and constraints…"
					rows={8}
					value={content}
					onChange={(e) => setContent(e.target.value)}
				/>
			</div>
			<div className="space-y-1.5">
				<Label htmlFor="skill-when">When to use</Label>
				<Textarea
					id="skill-when"
					placeholder="Signals the agent uses to decide when to apply this skill."
					rows={4}
					value={whenToUse}
					onChange={(e) => setWhenToUse(e.target.value)}
				/>
			</div>

			<FormError error={create.error ?? update.error} />

			<div className="flex justify-end gap-3 pt-2">
				<Button
					type="button"
					variant="outline"
					onClick={onDone}
					disabled={isSubmitting}
				>
					Cancel
				</Button>
				<Button type="submit" disabled={!formValid || isSubmitting}>
					{isSubmitting ? "Saving…" : isEdit ? "Save changes" : "Add skill"}
				</Button>
			</div>
		</form>
	);
}
