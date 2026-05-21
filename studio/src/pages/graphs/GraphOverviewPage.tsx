import { Button, Skeleton } from "@invana/ui";
import {
	ArrowRight,
	CheckCircle2,
	Circle,
	Database,
	FileText,
	GitGraph,
	Layers,
	Lightbulb,
	Network,
	SkipForward,
	Sparkles,
} from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import {
	useGraphQuery,
	useSetupSectionMutation,
} from "../../hooks/queries/useGraphs";
import type {
	Graph,
	SetupSection,
	SetupSectionState,
} from "../../types/graphs";

const REQUIRED: SetupSection[] = ["graph_info", "intent"];
const SKIPPABLE: SetupSection[] = ["skills", "datasets"];

interface SectionMeta {
	key: SetupSection;
	label: string;
	description: string;
	icon: typeof Database;
	settingsPath: (username: string, slug: string) => string;
}

const SECTIONS: SectionMeta[] = [
	{
		key: "graph_info",
		label: "Graph Info",
		description: "Attach a graph database connection.",
		icon: Database,
		settingsPath: (u, s) => `/u/${u}/${s}/settings/connection`,
	},
	{
		key: "intent",
		label: "Intent",
		description: "Describe what this graph is for.",
		icon: Lightbulb,
		settingsPath: (u, s) => `/u/${u}/${s}/settings/intent`,
	},
	{
		key: "skills",
		label: "Skills",
		description: "Define what the graph's agents can do. (Optional — S5)",
		icon: Sparkles,
		settingsPath: (u, s) => `/u/${u}/${s}/settings/skills`,
	},
	{
		key: "datasets",
		label: "Datasets",
		description: "Import data into the knowledge graph. (Optional — S6)",
		icon: Layers,
		settingsPath: (u, s) => `/u/${u}/${s}/settings/datasets`,
	},
];

function sectionStatus(
	state: SetupSectionState | undefined,
): "done" | "skipped" | "todo" {
	if (state?.completed_at) return "done";
	if (state?.skipped_at) return "skipped";
	return "todo";
}

function WizardSection({
	meta,
	state,
	graph,
	onSkip,
	onReset,
}: {
	meta: SectionMeta;
	state: SetupSectionState | undefined;
	graph: Graph;
	onSkip: () => void;
	onReset: () => void;
}) {
	const status = sectionStatus(state);
	const Icon = meta.icon;
	const isSkippable = SKIPPABLE.includes(meta.key);
	const path = meta.settingsPath(graph.owner_username, graph.slug);

	const statusIcon =
		status === "done" ? (
			<CheckCircle2 className="w-4 h-4 text-green-500" />
		) : status === "skipped" ? (
			<SkipForward className="w-4 h-4 text-muted-foreground" />
		) : (
			<Circle className="w-4 h-4 text-muted-foreground" />
		);

	return (
		<div className="flex items-start gap-4 py-4 border-b border-border last:border-0">
			<div className="mt-0.5">{statusIcon}</div>
			<div className="flex-1 min-w-0">
				<div className="flex items-center gap-2">
					<Icon className="w-4 h-4 text-muted-foreground" />
					<span className="font-medium">{meta.label}</span>
					{status === "done" && (
						<span className="text-muted-foreground">— done</span>
					)}
					{status === "skipped" && (
						<span className="text-muted-foreground">— skipped</span>
					)}
				</div>
				<p className="text-muted-foreground mt-1">{meta.description}</p>
			</div>
			<div className="flex items-center gap-2 shrink-0">
				{status === "todo" && isSkippable && (
					<Button variant="ghost" size="sm" onClick={onSkip}>
						Skip
					</Button>
				)}
				{(status === "skipped" || status === "done") && (
					<Button variant="ghost" size="sm" onClick={onReset}>
						Reset
					</Button>
				)}
				<Button
					variant={status === "todo" ? "default" : "outline"}
					size="sm"
					asChild
				>
					<Link to={path}>
						{status === "todo" ? "Set up" : "Edit"}
						<ArrowRight className="w-3.5 h-3.5 ml-1" />
					</Link>
				</Button>
			</div>
		</div>
	);
}

export function GraphOverviewPage() {
	const { username, slug } = useParams<{ username: string; slug: string }>();
	const navigate = useNavigate();
	const {
		data: graph,
		isLoading,
		isError,
		error,
	} = useGraphQuery(username, slug);
	const setupMutation = useSetupSectionMutation();

	if (isLoading) {
		return (
			<div className="h-full overflow-auto">
				<div className="max-w-3xl mx-auto px-10 py-12">
					<Skeleton className="h-10 w-72 mb-2" />
					<Skeleton className="h-5 w-96 mb-10" />
					<Skeleton className="h-64 w-full" />
				</div>
			</div>
		);
	}

	if (isError || !graph) {
		return (
			<div className="h-full overflow-auto">
				<div className="max-w-3xl mx-auto px-10 py-12">
					<p className="text-destructive">
						{error instanceof Error ? error.message : "Graph not found."}
					</p>
					<Button
						variant="outline"
						className="mt-4"
						onClick={() => navigate("/graphs")}
					>
						Back to graphs
					</Button>
				</div>
			</div>
		);
	}

	const setupComplete = REQUIRED.every(
		(k) => graph.setup_state?.[k]?.completed_at,
	);

	const handleSectionAction = (
		section: SetupSection,
		action: "complete" | "skip" | "reset",
	) => {
		setupMutation.mutate(
			{
				username: graph.owner_username,
				slug: graph.slug,
				section,
				action,
			},
			{
				onError: (err) => toast.error(err.message),
			},
		);
	};

	return (
		<div className="h-full overflow-auto">
			<div className="max-w-3xl mx-auto px-10 py-12">
				{/* Header */}
				<div className="mb-10">
					<div className="flex items-center gap-2 text-muted-foreground font-mono mb-2">
						<span>
							/u/{graph.owner_username}/{graph.slug}
						</span>
					</div>
					<h1 className="text-3xl font-bold">{graph.name}</h1>
					{graph.intent ? (
						<p className="text-muted-foreground mt-2">{graph.intent}</p>
					) : (
						<p className="text-muted-foreground/60 italic mt-2">
							No intent set yet.
						</p>
					)}
				</div>

				{/* Setup wizard */}
				<div className="border border-border rounded-lg p-6 mb-10">
					<div className="flex items-center justify-between mb-2">
						<h2 className="font-semibold">Setup</h2>
						{setupComplete ? (
							<span className="text-green-500 flex items-center gap-1.5">
								<CheckCircle2 className="w-4 h-4" />
								Ready
							</span>
						) : (
							<span className="text-muted-foreground">
								{
									SECTIONS.filter(
										(s) => sectionStatus(graph.setup_state?.[s.key]) !== "todo",
									).length
								}{" "}
								/ {SECTIONS.length} done
							</span>
						)}
					</div>
					<p className="text-muted-foreground mb-4">
						{setupComplete
							? "Modeller, Explorer, and Query are ready to use."
							: `Complete ${REQUIRED.map(
									(r) => SECTIONS.find((s) => s.key === r)?.label,
								).join(" + ")} to unlock Modeller, Explorer, and Query.`}
					</p>

					<div className="flex flex-col">
						{SECTIONS.map((section) => (
							<WizardSection
								key={section.key}
								meta={section}
								state={graph.setup_state?.[section.key]}
								graph={graph}
								onSkip={() => handleSectionAction(section.key, "skip")}
								onReset={() => handleSectionAction(section.key, "reset")}
							/>
						))}
					</div>
				</div>

				{/* Quick actions */}
				<div className="grid grid-cols-3 gap-4">
					<Button
						variant="outline"
						className="h-auto flex-col items-start gap-2 p-4"
						disabled={!setupComplete}
						onClick={() =>
							navigate(`/u/${graph.owner_username}/${graph.slug}/modeller`)
						}
					>
						<GitGraph className="w-5 h-5 text-muted-foreground" />
						<div className="text-left">
							<div className="font-medium">Modeller</div>
							<div className="text-muted-foreground">Define the ontology</div>
						</div>
					</Button>
					<Button
						variant="outline"
						className="h-auto flex-col items-start gap-2 p-4"
						disabled={!setupComplete}
						onClick={() =>
							navigate(`/u/${graph.owner_username}/${graph.slug}/explorer`)
						}
					>
						<Network className="w-5 h-5 text-muted-foreground" />
						<div className="text-left">
							<div className="font-medium">Explorer</div>
							<div className="text-muted-foreground">Visualise the graph</div>
						</div>
					</Button>
					<Button
						variant="outline"
						className="h-auto flex-col items-start gap-2 p-4"
						disabled={!setupComplete}
						onClick={() =>
							navigate(`/u/${graph.owner_username}/${graph.slug}/explorer`)
						}
					>
						<FileText className="w-5 h-5 text-muted-foreground" />
						<div className="text-left">
							<div className="font-medium">Query</div>
							<div className="text-muted-foreground">Run Cypher / Gremlin</div>
						</div>
					</Button>
				</div>
			</div>
		</div>
	);
}
