import { Badge, Button, Input, Label, Skeleton, Textarea } from "@invana/ui";
import { Plus, ScrollText, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
	useCreateInstructionMutation,
	useDeleteInstructionMutation,
	useInstructionsQuery,
	useUpdateInstructionMutation,
} from "../../../hooks/queries/useInstructions";
import type {
	Instruction,
	InstructionCreate,
} from "../../../types/instructions";
import { FormError } from "../../forms/FormError";

interface Props {
	username: string;
	graphSlug: string;
}

export function InstructionsSection({ username, graphSlug }: Props) {
	const { data, isLoading } = useInstructionsQuery(username, graphSlug);
	const [editing, setEditing] = useState<"new" | Instruction | null>(null);

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
			<InstructionForm
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
					Operational directives the Graph's agents follow. Higher priority
					wins.
				</p>
				<Button onClick={() => setEditing("new")}>
					<Plus className="w-4 h-4 mr-1" />
					Add instruction
				</Button>
			</div>

			{items.length === 0 ? (
				<div className="border border-border rounded-lg p-8 flex flex-col items-center gap-3 text-center">
					<ScrollText className="w-8 h-8 text-muted-foreground opacity-50" />
					<p className="text-muted-foreground">
						No instructions yet. Add one to shape how your agents behave.
					</p>
				</div>
			) : (
				<div className="border border-border rounded-lg divide-y divide-border">
					{items.map((i) => (
						<InstructionRow
							key={i.id}
							username={username}
							graphSlug={graphSlug}
							instruction={i}
							onEdit={() => setEditing(i)}
						/>
					))}
				</div>
			)}
		</div>
	);
}

function InstructionRow({
	username,
	graphSlug,
	instruction,
	onEdit,
}: {
	username: string;
	graphSlug: string;
	instruction: Instruction;
	onEdit: () => void;
}) {
	const remove = useDeleteInstructionMutation(username, graphSlug);
	return (
		<div className="flex items-start gap-4 px-4 py-3">
			<div className="flex-1 min-w-0">
				<div className="flex items-center gap-2">
					<p className="font-medium truncate">{instruction.name}</p>
					<Badge variant="secondary" className="shrink-0">
						p{instruction.priority}
					</Badge>
				</div>
				{instruction.content && (
					<p className="text-muted-foreground mt-0.5 line-clamp-2">
						{instruction.content}
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
						if (!confirm(`Delete instruction "${instruction.name}"?`)) return;
						remove.mutate(instruction.id, {
							onError: (err) => toast.error(err.message),
							onSuccess: () => toast.success("Instruction deleted"),
						});
					}}
				>
					<Trash2 className="w-4 h-4" />
				</Button>
			</div>
		</div>
	);
}

function InstructionForm({
	username,
	graphSlug,
	existing,
	onDone,
}: {
	username: string;
	graphSlug: string;
	existing: Instruction | null;
	onDone: () => void;
}) {
	const isEdit = !!existing;
	const create = useCreateInstructionMutation(username, graphSlug);
	const update = useUpdateInstructionMutation(username, graphSlug);

	const [name, setName] = useState(existing?.name ?? "");
	const [content, setContent] = useState(existing?.content ?? "");
	const [priority, setPriority] = useState(existing?.priority ?? 100);

	const formValid = !!name.trim() && priority >= 0 && priority <= 1000;
	const isSubmitting = create.isPending || update.isPending;

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		if (!formValid) return;
		const payload: InstructionCreate = {
			name: name.trim(),
			content,
			priority,
		};
		if (isEdit && existing) {
			update.mutate(
				{ id: existing.id, data: payload },
				{
					onSuccess: () => {
						toast.success("Instruction saved");
						onDone();
					},
					onError: (err) => toast.error(err.message),
				},
			);
		} else {
			create.mutate(payload, {
				onSuccess: () => {
					toast.success("Instruction added");
					onDone();
				},
				onError: (err) => toast.error(err.message),
			});
		}
	};

	return (
		<form onSubmit={handleSubmit} className="space-y-5" noValidate>
			<div className="space-y-1.5">
				<Label htmlFor="instr-name">
					Name <span className="text-destructive">*</span>
				</Label>
				<Input
					id="instr-name"
					placeholder="cite-sources"
					value={name}
					onChange={(e) => setName(e.target.value)}
					maxLength={255}
				/>
			</div>
			<div className="space-y-1.5">
				<Label htmlFor="instr-priority">
					Priority{" "}
					<span className="text-muted-foreground">(0–1000, default 100)</span>
				</Label>
				<Input
					id="instr-priority"
					type="number"
					min={0}
					max={1000}
					value={priority}
					onChange={(e) => setPriority(Number(e.target.value))}
				/>
			</div>
			<div className="space-y-1.5">
				<Label htmlFor="instr-content">Content (markdown)</Label>
				<Textarea
					id="instr-content"
					placeholder="Always cite the source node ID when answering factual questions…"
					rows={10}
					value={content}
					onChange={(e) => setContent(e.target.value)}
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
					{isSubmitting
						? "Saving…"
						: isEdit
							? "Save changes"
							: "Add instruction"}
				</Button>
			</div>
		</form>
	);
}
