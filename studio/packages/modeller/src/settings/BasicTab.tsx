import { Form, FormField, InputField, TextareaField } from "@invana/forms";
import {
	Button,
	Card,
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	Skeleton,
} from "@invana/ui";
import {
	type Graph,
	type GraphUpdate,
	isSetupComplete,
	useGraphQuery,
	useUpdateGraphMutation,
} from "@invana-studio/core";
import { ActButton, SetupTimeline } from "@invana-studio/shell";
import { FormError } from "@invana-studio/ui";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

interface Props {
	username: string;
	graphSlug: string;
}

/**
 * Graph settings › **Basic** — what this Graph is called and what it is for
 * (`modeller.settings`).
 *
 * Name, description and instructions are one form with one *Save*: all three
 * are the same answer written at three lengths. Instructions are the one field
 * here that changes what an answer looks like — the runtime hands them to the
 * LLM as this Graph's standing guidance.
 *
 * While the Graph's required setup is unfinished the setup timeline leads the
 * tab, because what a Graph still needs is the first thing its settings answer.
 * *Archive* sits below the form and confirms; *Unarchive* does not.
 */
export function BasicTab({ username, graphSlug }: Props) {
	const { data: graph, isLoading } = useGraphQuery(username, graphSlug);
	const mutation = useUpdateGraphMutation();

	// The API's `{ message, data }` envelope toasts success centrally.
	const save = (data: GraphUpdate) =>
		mutation.mutate(
			{ username, graphSlug, data },
			{ onError: (err) => toast.error(err.message) },
		);

	if (isLoading) {
		return (
			<div className="flex flex-col gap-4">
				<Skeleton className="h-9 w-full" />
				<Skeleton className="h-24 w-full" />
				<Skeleton className="h-40 w-full" />
			</div>
		);
	}
	if (!graph) return <p className="text-muted-foreground">Graph not found.</p>;

	return (
		<>
			{!isSetupComplete(graph) && <SetupTimeline graph={graph} />}
			<BasicForm
				graph={graph}
				pending={mutation.isPending}
				error={mutation.error}
				onSave={save}
			/>
			<ArchiveCard
				graph={graph}
				pending={mutation.isPending}
				onArchive={() => save({ status: "archived" })}
				onUnarchive={() => save({ status: "active" })}
			/>
		</>
	);
}

interface BasicShape {
	name: string;
	description: string;
	instructions: string;
}

function BasicForm({
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
	const form = useForm<BasicShape>({
		defaultValues: { name: "", description: "", instructions: "" },
	});

	// Follow the Graph's values once it loads, and after a save refetches it.
	useEffect(() => {
		form.reset({
			name: graph.name,
			description: graph.description ?? "",
			instructions: graph.instructions ?? "",
		});
	}, [graph, form]);

	const submit = form.handleSubmit((values) => {
		const name = values.name.trim();
		if (!name) {
			form.setError("name", { message: "Name is required." });
			return;
		}
		onSave({
			name,
			description: values.description.trim() || null,
			instructions: values.instructions.trim() || null,
		});
	});

	return (
		<Form {...form}>
			<form onSubmit={submit} className="flex flex-col gap-4" noValidate>
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
					name="instructions"
					render={({ field }) => (
						<TextareaField
							label="Instructions"
							description="What this graph is for, what questions it should answer, and how its agents should behave. Grounds every prompt this graph runs."
							placeholder="Describe what this graph is for and how its agents should behave…"
							rows={8}
							labelPosition="top"
							size="md"
							value={field.value}
							onChange={field.onChange}
						/>
					)}
				/>
				<FormError error={error} />
				<div>
					<ActButton area="settings" type="submit" disabled={pending}>
						{pending ? "Saving…" : "Save"}
					</ActButton>
				</div>
			</form>
		</Form>
	);
}

function ArchiveCard({
	graph,
	pending,
	onArchive,
	onUnarchive,
}: {
	graph: Graph;
	pending: boolean;
	onArchive: () => void;
	onUnarchive: () => void;
}) {
	const [confirming, setConfirming] = useState(false);
	const archived = graph.status === "archived";

	return (
		<Card className="flex flex-row items-center justify-between gap-4 p-4 shadow-none">
			<div className="min-w-0">
				<p className="font-medium">
					{archived ? `Unarchive ${graph.name}` : `Archive ${graph.name}`}
				</p>
				<p className="text-muted-foreground">
					{archived
						? "Archived — hidden from your graph list. Unarchive it to move it back."
						: "Hides it from your graph list. It stays reachable by link, queryable, and you can unarchive it any time."}
				</p>
			</div>
			<ActButton
				area="settings"
				variant="outline"
				className="shrink-0"
				disabled={pending}
				onClick={archived ? onUnarchive : () => setConfirming(true)}
			>
				{archived ? "Unarchive" : "Archive"}
			</ActButton>

			<Dialog open={confirming} onOpenChange={setConfirming}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Archive {graph.name}?</DialogTitle>
						<DialogDescription>
							It moves to the Archived filter of your graph list. Nothing is
							deleted: members keep access, it stays reachable by link, and it
							remains queryable.
						</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<Button variant="outline" onClick={() => setConfirming(false)}>
							Cancel
						</Button>
						<Button
							disabled={pending}
							onClick={() => {
								onArchive();
								setConfirming(false);
							}}
						>
							Archive graph
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</Card>
	);
}
