import { Form, FormField, InputField, TextareaField } from "@invana/forms";
import {
	Badge,
	Button,
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	Skeleton,
} from "@invana/ui";
import { Archive, ArchiveRestore } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import {
	useGraphQuery,
	useUpdateGraphMutation,
} from "../../../hooks/queries/useGraphs";
import type { Graph, GraphUpdate } from "../../../types/graphs";
import { FormError } from "../../forms/FormError";

interface Props {
	username: string;
	graphSlug: string;
}

/**
 * Graph settings / edit panel. Owns every editable field on the Graph
 * container — name, description, instructions, objectives, success criteria —
 * shown in edit mode by default, plus the Archive action. The Info section
 * keeps the read-only overview (connection, stats, setup wizard).
 */
export function SettingsSection({ username, graphSlug }: Props) {
	const { data: graph, isLoading } = useGraphQuery(username, graphSlug);
	const mutation = useUpdateGraphMutation();
	const archived = graph?.status === "archived";

	// Success toasts are owned by the backend (RFC-028): the API returns a
	// `{ message, data }` envelope and the axios layer toasts `message` centrally,
	// so we only handle the error here.
	const save = (data: GraphUpdate) => {
		mutation.mutate(
			{ username, graphSlug, data },
			{ onError: (err) => toast.error(err.message) },
		);
	};

	const setArchived = (next: boolean) =>
		save({ status: next ? "archived" : "active" });

	if (isLoading) {
		return (
			<div className="space-y-4">
				<Skeleton className="h-10 w-3/4" />
				<Skeleton className="h-24 w-full" />
				<Skeleton className="h-32 w-full" />
			</div>
		);
	}
	if (!graph) return <p className="text-muted-foreground">Graph not found.</p>;

	return (
		<div className="space-y-6">
			<div className="flex items-center gap-2">
				<p className="font-mono text-muted-foreground">
					@{graph.owner_username} / {graph.slug}
				</p>
				{archived && <Badge variant="outline">Archived</Badge>}
			</div>

			<DetailsForm
				graph={graph}
				pending={mutation.isPending}
				error={mutation.error}
				onSave={save}
			/>

			<ArchivePanel
				archived={!!archived}
				pending={mutation.isPending}
				onArchive={() => setArchived(true)}
				onUnarchive={() => setArchived(false)}
			/>
		</div>
	);
}

interface DetailsShape {
	name: string;
	description: string;
	instructions: string;
	objectives: string;
	success_criteria: string;
}

function DetailsForm({
	graph,
	pending,
	error,
	onSave,
}: {
	graph: Graph;
	pending: boolean;
	error: Error | null;
	onSave: (data: GraphUpdate) => void;
}) {
	const form = useForm<DetailsShape>({
		defaultValues: {
			name: "",
			description: "",
			instructions: "",
			objectives: "",
			success_criteria: "",
		},
	});

	// Sync the form to the graph's values once it loads (and after a save
	// refetches it).
	useEffect(() => {
		form.reset({
			name: graph.name,
			description: graph.description ?? "",
			instructions: graph.instructions ?? "",
			objectives: graph.objectives ?? "",
			success_criteria: graph.success_criteria ?? "",
		});
	}, [graph, form]);

	const submitForm = form.handleSubmit((values) => {
		const name = values.name.trim();
		if (!name) {
			form.setError("name", { message: "Name is required." });
			return;
		}
		onSave({
			name,
			description: values.description.trim() || null,
			instructions: values.instructions.trim() || null,
			objectives: values.objectives.trim() || null,
			success_criteria: values.success_criteria.trim() || null,
		});
	});

	return (
		<Form {...form}>
			<form onSubmit={submitForm} className="space-y-4" noValidate>
				<FormField
					control={form.control}
					name="name"
					render={({ field }) => (
						<InputField
							label="Name"
							placeholder="Customer analysis"
							labelPosition="top"
							size="md"
							value={field.value}
							onChange={field.onChange}
						/>
					)}
				/>
				<FormField
					control={form.control}
					name="description"
					render={({ field }) => (
						<TextareaField
							label="Description"
							description="A short summary of this graph."
							placeholder="What does this graph contain?"
							rows={2}
							labelPosition="top"
							size="md"
							value={field.value}
							onChange={field.onChange}
						/>
					)}
				/>
				<FormField
					control={form.control}
					name="instructions"
					render={({ field }) => (
						<TextareaField
							label="Instructions"
							description="Standing instructions this graph's agents follow — what it's for, what questions it should answer, and how it should behave. Used to ground prompts and agents."
							placeholder="Describe what this graph is for and how its agents should behave…"
							rows={8}
							labelPosition="top"
							size="md"
							value={field.value}
							onChange={field.onChange}
						/>
					)}
				/>
				<FormField
					control={form.control}
					name="objectives"
					render={({ field }) => (
						<TextareaField
							label="Objectives"
							description="What this graph is pursuing — measurable targets."
							placeholder="What is this graph trying to achieve?"
							rows={3}
							labelPosition="top"
							size="md"
							value={field.value}
							onChange={field.onChange}
						/>
					)}
				/>
				<FormField
					control={form.control}
					name="success_criteria"
					render={({ field }) => (
						<TextareaField
							label="Success criteria"
							description="How we know the graph's objectives are met."
							placeholder="What does success look like?"
							rows={3}
							labelPosition="top"
							size="md"
							value={field.value}
							onChange={field.onChange}
						/>
					)}
				/>

				<FormError error={error} />
				<div className="flex items-center gap-2">
					<Button type="submit" disabled={pending}>
						{pending ? "Saving…" : "Save settings"}
					</Button>
				</div>
			</form>
		</Form>
	);
}

function ArchivePanel({
	archived,
	pending,
	onArchive,
	onUnarchive,
}: {
	archived: boolean;
	pending: boolean;
	onArchive: () => void;
	onUnarchive: () => void;
}) {
	const [confirmOpen, setConfirmOpen] = useState(false);

	const confirmArchive = () => {
		onArchive();
		setConfirmOpen(false);
	};

	return (
		<div className="border border-border rounded-lg p-4 flex items-start justify-between gap-4">
			<div className="min-w-0">
				<p className="font-medium">
					{archived ? "Unarchive graph" : "Archive graph"}
				</p>
				<p className="text-muted-foreground mt-0.5">
					{archived
						? "This graph is archived and hidden from your graph list. Unarchive it to move it back to the active list."
						: "Hides this graph from your graph list — it moves to the Archived filter. It stays reachable by link and remains queryable, and you can unarchive it anytime."}
				</p>
			</div>
			<Button
				variant="outline"
				className="shrink-0"
				disabled={pending}
				onClick={archived ? onUnarchive : () => setConfirmOpen(true)}
			>
				{archived ? (
					<>
						<ArchiveRestore className="w-4 h-4 mr-1.5" />
						Unarchive
					</>
				) : (
					<>
						<Archive className="w-4 h-4 mr-1.5" />
						Archive
					</>
				)}
			</Button>

			<Dialog
				open={confirmOpen}
				onOpenChange={(open) => !open && setConfirmOpen(false)}
			>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Archive this graph?</DialogTitle>
						<DialogDescription>
							Archiving hides the graph from your graph list — it moves into the
							Archived filter. Nothing is deleted: members keep access, it stays
							reachable by link, and it remains queryable. You can unarchive it
							anytime from here.
						</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<Button
							variant="outline"
							onClick={() => setConfirmOpen(false)}
							disabled={pending}
						>
							Cancel
						</Button>
						<Button onClick={confirmArchive} disabled={pending}>
							{pending ? "Archiving…" : "Archive graph"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}
