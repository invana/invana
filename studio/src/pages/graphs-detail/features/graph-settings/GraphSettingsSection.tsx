import { FormError } from "@/components/forms/FormError";
import {
	useGraphConnectionQuery,
	useGraphQuery,
	useUpdateGraphMutation,
} from "@/hooks/queries/useGraphs";
import { ConcurrencyFields } from "@/pages/graphs-detail/features/graph-settings/ConcurrencyFields";
import { ConnectionFields } from "@/pages/graphs-detail/features/graph-settings/ConnectionFields";
import { useSettingsPanel } from "@/pages/graphs-detail/shell/useSettingsPanel";
import type { Graph, GraphUpdate } from "@/types/graphs";
import { Form, FormField, InputField, TextareaField } from "@invana/forms";
import {
	Button,
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	type NavHorizontalItem,
	Skeleton,
	TabbedPanel,
} from "@invana/ui";
import { Archive, ArchiveRestore, Bot, Database, Info } from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

/** The tabs, in strip order. `?tab=` carries the open one. */
export const SETTINGS_TABS = ["basic", "graph", "agents"] as const;
export type SettingsTab = (typeof SETTINGS_TABS)[number];

interface Props {
	username: string;
	graphSlug: string;
	/** The panel chrome's right-hand actions — maximize and close. */
	headerActions?: NavHorizontalItem[];
}

/**
 * The settings panel — **four tabs, one per question a person arrives with**
 * (`Graph · settings` hi-fi).
 *
 * | Tab | What it answers | Fields |
 * |---|---|---|
 * | Basic | what is this graph called, and what is it for | name · description · instructions · archive |
 * | Graph | what database does it read | the connection |
 * | LLMs | what does it think with | the providers (G29) |
 * | Agents | how hard may they run here | concurrency |
 *
 * One flat form of everything was the earlier shape, and it read as a junk
 * drawer: a name sat above a connection string sat above a ceiling on
 * concurrent runs, three unrelated questions saved by two different
 * buttons. **The tab is the group now**, so no tab wraps its fields in a
 * collapsible section: a group that is the only thing in its tab is a title over
 * a title, with a disclosure arrow that hides the tab's whole reason for
 * existing. What survives of the old group header is its one-line rule, and the
 * connection's state chip beside it.
 *
 * The connection is a tab here rather than a page of its own (CD6), and it
 * still carries its own state chip: the two never save together — a connection
 * has to *pass a test* before it is allowed to (connect-a-database.md CD2).
 *
 * `@owner / slug` is not on Basic. The breadcrumb above the panel already reads
 * it (graph-detail-page.md G16), and a panel that repeats its own header is
 * saying nothing twice. Every tab's body is `p-4` — the number every other
 * docked panel uses.
 *
 * **Instructions are a Basic field, saved with the name and the description.**
 * What a graph is for is the third thing anyone asks after what it is called and
 * what is in it, and all three are the same answer written at three lengths — so
 * they are one form with one Save. Agents is left with the one thing that is
 * genuinely about running agents rather than describing the graph: the ceiling.
 *
 * Gone with this split: `objectives` and `success_criteria`. Those belong to a
 * Project, not a Graph — a Graph is a bounded domain and has no goals of its
 * own (objectives-and-criteria.md D1) — and both columns were written by this
 * form and read by nothing. `instructions` stays: the runtime hands it to the
 * LLM as this graph's standing guidance, so it is the one field here that
 * changes what an answer looks like.
 */
export function GraphSettingsSection({
	username,
	graphSlug,
	headerActions,
}: Props) {
	const { data: graph, isLoading } = useGraphQuery(username, graphSlug);
	const { data: connection } = useGraphConnectionQuery(username, graphSlug);
	const { tab, setSection } = useSettingsPanel();
	const mutation = useUpdateGraphMutation();

	// A connection that never connected is not "saved" — the chip says which.
	const connectionState: ConnectionState = !connection
		? "unset"
		: connection.status === "ACTIVE"
			? "tested"
			: "untested";

	// Success toasts are owned by the backend: the API returns a
	// `{ message, data }` envelope and the axios layer toasts `message` centrally,
	// so we only handle the error here.
	const save = (data: GraphUpdate) => {
		mutation.mutate(
			{ username, graphSlug, data },
			{ onError: (err) => toast.error(err.message) },
		);
	};

	// `p-4` is the panel-body padding across Studio — LLMs, the Model panel, the
	// Explorer's own blocks. One number for every docked panel, so switching rail
	// icons does not move the content sideways.
	const body = (content: ReactNode) => (
		<div className="space-y-4 p-4">{content}</div>
	);

	// The providers are no longer here at all: `Agents › LLMs` holds them (PM6),
	// and `?panel=llms` is aliased onto that panel rather than onto a tab.
	const active: SettingsTab = SETTINGS_TABS.includes(tab as SettingsTab)
		? (tab as SettingsTab)
		: "basic";

	const content = (render: (g: Graph) => ReactNode) =>
		body(
			isLoading ? (
				<div className="space-y-4">
					<Skeleton className="h-10 w-3/4" />
					<Skeleton className="h-24 w-full" />
					<Skeleton className="h-32 w-full" />
				</div>
			) : !graph ? (
				<p className="text-muted-foreground">Graph not found.</p>
			) : (
				render(graph)
			),
		);

	return (
		<TabbedPanel
			className="h-full"
			activeTab={active}
			onTabChange={(value) => setSection("settings", value)}
			headerActions={headerActions}
			tabs={[
				{
					value: "basic",
					label: "Basic",
					icon: Info,
					content: content((g) => (
						<>
							<BasicForm
								graph={g}
								pending={mutation.isPending}
								error={mutation.error}
								onSave={save}
							/>
							<ArchivePanel
								archived={g.status === "archived"}
								pending={mutation.isPending}
								onArchive={() => save({ status: "archived" })}
								onUnarchive={() => save({ status: "active" })}
							/>
						</>
					)),
				},
				{
					value: "graph",
					label: "Graph",
					icon: Database,
					content: content(() => (
						<>
							<TabRule state={connectionState}>
								Required · Test gates Save · the connector is read-only after
								the first save
							</TabRule>
							<ConnectionFields username={username} graphSlug={graphSlug} />
						</>
					)),
				},
				{
					value: "agents",
					label: "Agents",
					icon: Bot,
					content: content(() => (
						<>
							<TabRule>
								A budget bounds one agent. This bounds the Graph — the database
								it queries and the provider behind it.
							</TabRule>
							<ConcurrencyFields username={username} graphSlug={graphSlug} />
						</>
					)),
				},
			]}
		/>
	);
}

/** Whether the connection has been proved, for the chip on the Graph tab. */
type ConnectionState = "tested" | "untested" | "unset";

const STATE_COPY: Record<ConnectionState, { label: string; tone: string }> = {
	tested: { label: "tested", tone: "text-success" },
	untested: { label: "not tested", tone: "text-warning" },
	unset: { label: "not set", tone: "text-muted-foreground" },
};

/**
 * The one line a tab is governed by, above its fields.
 *
 * It replaces the collapsible group header these tabs used to sit inside. A
 * group that is the only thing in its tab is a title over a title and a
 * disclosure arrow that hides the tab's whole reason for existing — the strip
 * already names it, so what is left worth saying is the rule, and the chip
 * where there is state to report.
 */
function TabRule({
	state,
	children,
}: {
	state?: ConnectionState;
	children: ReactNode;
}) {
	const chip = state ? STATE_COPY[state] : null;

	return (
		<div className="flex items-start justify-between gap-3 text-sm text-muted-foreground">
			<p className="min-w-0">{children}</p>
			{chip ? (
				<span className={`shrink-0 ${chip.tone}`}>{chip.label}</span>
			) : null}
		</div>
	);
}

// ── Basic ────────────────────────────────────────────────────────────────────

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

	// Sync the form to the graph's values once it loads (and after a save
	// refetches it).
	useEffect(() => {
		form.reset({
			name: graph.name,
			description: graph.description ?? "",
			instructions: graph.instructions ?? "",
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
							rows={10}
							labelPosition="top"
							size="md"
							value={field.value}
							onChange={field.onChange}
						/>
					)}
				/>

				<FormError error={error} />
				<Button type="submit" disabled={pending}>
					{pending ? "Saving…" : "Save"}
				</Button>
			</form>
		</Form>
	);
}

// ── Archive ──────────────────────────────────────────────────────────────────

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
