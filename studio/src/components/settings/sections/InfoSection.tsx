import { Form, FormField, InputField, TextareaField } from "@invana/forms";
import { Badge, Button, Skeleton } from "@invana/ui";
import {
	Archive,
	ArchiveRestore,
	Database,
	Pencil,
	Sparkles,
	Users,
	Wand2,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import {
	useGraphConnectionQuery,
	useGraphQuery,
	useUpdateGraphMutation,
} from "../../../hooks/queries/useGraphs";
import { useLLMProvidersQuery } from "../../../hooks/queries/useLLMProviders";
import { useSkillsQuery } from "../../../hooks/queries/useSkills";
import type { Graph, GraphUpdate } from "../../../types/graphs";
import { FormError } from "../../forms/FormError";
import { SetupWizard } from "./SetupWizard";

interface Props {
	username: string;
	graphSlug: string;
}

/**
 * The graph's "home" panel: a read-only details view (name, description,
 * objectives, success criteria) with an Edit toggle + Archive action,
 * connection status, counts of graph-scoped resources (LLM providers, Skills,
 * Members), and the full setup wizard. Instructions live in their own rail
 * section; the DB connection under its own "Connection" icon.
 */
export function InfoSection({ username, graphSlug }: Props) {
	const { data: graph, isLoading: graphLoading } = useGraphQuery(
		username,
		graphSlug,
	);
	const { data: connection } = useGraphConnectionQuery(username, graphSlug);
	const { data: llms } = useLLMProvidersQuery(username, graphSlug);
	const { data: skills } = useSkillsQuery(username, graphSlug);

	if (graphLoading) {
		return (
			<div className="space-y-4">
				<Skeleton className="h-10 w-3/4" />
				<Skeleton className="h-24 w-full" />
				<Skeleton className="h-32 w-full" />
			</div>
		);
	}
	if (!graph) {
		return <p className="text-muted-foreground">Graph not found.</p>;
	}

	const defaultLLM = llms?.items.find((p) => p.is_default);

	return (
		<div className="space-y-5">
			{/* Details — read-only by default, edit on demand */}
			<GraphDetails username={username} graphSlug={graphSlug} graph={graph} />

			{/* Connection status */}
			<div className="border border-border rounded-lg p-4">
				<div className="flex items-center justify-between mb-1">
					<span className="font-medium flex items-center gap-2">
						<Database className="w-4 h-4 text-muted-foreground" />
						Connection
					</span>
					{connection ? (
						<ConnectionStatusBadge status={connection.status} />
					) : (
						<Badge variant="outline">Not attached</Badge>
					)}
				</div>
				{connection ? (
					<>
						<p className="font-mono text-muted-foreground truncate">
							{connection.uri}
						</p>
						{connection.latency_ms !== null && (
							<p className="text-muted-foreground mt-0.5">
								latency · {connection.latency_ms} ms
							</p>
						)}
					</>
				) : (
					<p className="text-muted-foreground">
						Attach a graph database to make this Graph queryable.
					</p>
				)}
			</div>

			{/* Stats grid */}
			<div className="grid grid-cols-2 gap-3">
				<StatCard
					label="LLM providers"
					count={llms?.total ?? 0}
					icon={Sparkles}
					footer={defaultLLM ? `default · ${defaultLLM.model_id}` : undefined}
				/>
				<StatCard label="Skills" count={skills?.total ?? 0} icon={Wand2} />
				<StatCard label="Members" count={graph.member_count} icon={Users} />
			</div>

			{/* Setup wizard — moved from GraphOverviewPage so the actionable
			    progress sits with the rest of the at-a-glance info. */}
			<SetupWizard graph={graph} />
		</div>
	);
}

function GraphDetails({
	username,
	graphSlug,
	graph,
}: {
	username: string;
	graphSlug: string;
	graph: Graph;
}) {
	const mutation = useUpdateGraphMutation();
	const archived = graph.status === "archived";

	const save = (data: GraphUpdate, onDone?: () => void) => {
		mutation.mutate(
			{ username, graphSlug, data },
			{
				onSuccess: () => onDone?.(),
				onError: (err) => toast.error(err.message),
			},
		);
	};

	const toggleArchive = () =>
		save({ status: archived ? "active" : "archived" }, () =>
			toast.success(archived ? "Graph unarchived" : "Graph archived"),
		);

	return (
		<DetailsEditor
			graph={graph}
			archived={archived}
			pending={mutation.isPending}
			error={mutation.error}
			onSave={save}
			onToggleArchive={toggleArchive}
		/>
	);
}

interface DetailsShape {
	name: string;
	description: string;
	objectives: string;
	success_criteria: string;
}

function DetailsEditor({
	graph,
	archived,
	pending,
	error,
	onSave,
	onToggleArchive,
}: {
	graph: Graph;
	archived: boolean;
	pending: boolean;
	error: Error | null;
	onSave: (data: GraphUpdate, onDone?: () => void) => void;
	onToggleArchive: () => void;
}) {
	const [editing, setEditing] = useState(false);
	const form = useForm<DetailsShape>({
		defaultValues: {
			name: "",
			description: "",
			objectives: "",
			success_criteria: "",
		},
	});

	// Reset the form to the graph's values whenever we enter edit mode (and when
	// the graph refetches after a save).
	useEffect(() => {
		form.reset({
			name: graph.name,
			description: graph.description ?? "",
			objectives: graph.objectives ?? "",
			success_criteria: graph.success_criteria ?? "",
		});
	}, [graph, form]);

	if (!editing) {
		return (
			<div className="space-y-3">
				<div className="flex items-start justify-between gap-2">
					<div className="min-w-0">
						<p className="text-muted-foreground font-mono">
							@{graph.owner_username} / {graph.slug}
						</p>
						<h2 className="text-xl font-semibold mt-1 flex items-center gap-2">
							{graph.name}
							{archived && <Badge variant="outline">Archived</Badge>}
						</h2>
					</div>
					<div className="flex items-center gap-2 shrink-0">
						<Button
							variant="outline"
							size="sm"
							onClick={() => setEditing(true)}
						>
							<Pencil className="w-4 h-4 mr-1.5" />
							Edit
						</Button>
						<Button
							variant="outline"
							size="sm"
							disabled={pending}
							onClick={onToggleArchive}
							title={archived ? "Unarchive graph" : "Archive graph"}
						>
							{archived ? (
								<ArchiveRestore className="w-4 h-4" />
							) : (
								<Archive className="w-4 h-4" />
							)}
						</Button>
					</div>
				</div>

				{graph.description ? (
					<p className="text-muted-foreground">{graph.description}</p>
				) : (
					<p className="text-muted-foreground/60 italic">No description.</p>
				)}

				<ReadField label="Objectives" value={graph.objectives} />
				<ReadField label="Success criteria" value={graph.success_criteria} />
			</div>
		);
	}

	const submitForm = form.handleSubmit((values) => {
		const name = values.name.trim();
		if (!name) {
			form.setError("name", { message: "Name is required." });
			return;
		}
		onSave(
			{
				name,
				description: values.description.trim() || null,
				objectives: values.objectives.trim() || null,
				success_criteria: values.success_criteria.trim() || null,
			},
			() => {
				toast.success("Graph details saved");
				setEditing(false);
			},
		);
	});

	return (
		<Form {...form}>
			<form onSubmit={submitForm} className="space-y-4" noValidate>
				<p className="text-muted-foreground font-mono">
					@{graph.owner_username} / {graph.slug}
				</p>

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
						{pending ? "Saving…" : "Save details"}
					</Button>
					<Button
						type="button"
						variant="ghost"
						disabled={pending}
						onClick={() => setEditing(false)}
					>
						Cancel
					</Button>
				</div>
			</form>
		</Form>
	);
}

function ReadField({ label, value }: { label: string; value: string | null }) {
	return (
		<div>
			<p className="text-xs font-medium uppercase tracking-wide text-muted-foreground/70">
				{label}
			</p>
			{value ? (
				<p className="text-muted-foreground whitespace-pre-wrap mt-0.5">
					{value}
				</p>
			) : (
				<p className="text-muted-foreground/60 italic mt-0.5">Not set yet.</p>
			)}
		</div>
	);
}

function StatCard({
	label,
	count,
	icon: Icon,
	footer,
}: {
	label: string;
	count: number;
	icon: typeof Database;
	footer?: string;
}) {
	return (
		<div className="border border-border rounded-lg p-3">
			<div className="flex items-center gap-2 text-muted-foreground">
				<Icon className="w-4 h-4" />
				<span>{label}</span>
			</div>
			<p className="text-2xl font-semibold tabular-nums mt-1">{count}</p>
			{footer && (
				<p className="text-muted-foreground font-mono mt-0.5 truncate">
					{footer}
				</p>
			)}
		</div>
	);
}

function ConnectionStatusBadge({ status }: { status: string }) {
	if (status === "ACTIVE")
		return (
			<Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
				Active
			</Badge>
		);
	if (status === "CONNECTING")
		return (
			<Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400">
				Connecting
			</Badge>
		);
	if (status === "ERROR") return <Badge variant="destructive">Error</Badge>;
	return <Badge variant="outline">{status}</Badge>;
}
