import { Badge, Skeleton } from "@invana/ui";
import {
	CheckCircle2,
	Circle,
	Database,
	Layers,
	Lightbulb,
	ScrollText,
	SkipForward,
	Sparkles,
	Users,
	Wand2,
} from "lucide-react";
import {
	useGraphConnectionQuery,
	useGraphQuery,
} from "../../../hooks/queries/useGraphs";
import { useInstructionsQuery } from "../../../hooks/queries/useInstructions";
import { useLLMProvidersQuery } from "../../../hooks/queries/useLLMProviders";
import { useSkillsQuery } from "../../../hooks/queries/useSkills";
import type { SetupSectionState } from "../../../types/graphs";

interface Props {
	username: string;
	graphSlug: string;
}

/**
 * Read-only overview of the graph — connection status, counts of every
 * graph-scoped resource (LLM providers, Skills, Instructions, Members), and
 * setup wizard progress. The actual editing surfaces live behind their own
 * rail icons (Connection, Intent, LLMs, ...).
 */
export function InfoSection({ username, graphSlug }: Props) {
	const { data: graph, isLoading: graphLoading } = useGraphQuery(
		username,
		graphSlug,
	);
	const { data: connection } = useGraphConnectionQuery(username, graphSlug);
	const { data: llms } = useLLMProvidersQuery(username, graphSlug);
	const { data: skills } = useSkillsQuery(username, graphSlug);
	const { data: instructions } = useInstructionsQuery(username, graphSlug);

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
			{/* Header */}
			<div>
				<p className="text-muted-foreground font-mono">
					@{graph.owner_username} / {graph.slug}
				</p>
				<h2 className="text-xl font-semibold mt-1">{graph.name}</h2>
				{graph.intent ? (
					<p className="text-muted-foreground mt-2 line-clamp-3">
						{graph.intent}
					</p>
				) : (
					<p className="text-muted-foreground/60 italic mt-2">
						No intent set yet.
					</p>
				)}
			</div>

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
				<StatCard
					label="Instructions"
					count={instructions?.total ?? 0}
					icon={ScrollText}
				/>
				<StatCard label="Members" count={graph.member_count} icon={Users} />
			</div>

			{/* Setup state */}
			<div className="border border-border rounded-lg p-4">
				<h3 className="font-medium mb-2">Setup</h3>
				<div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
					<SetupRow
						label="Graph info"
						state={graph.setup_state?.graph_info}
						icon={Database}
					/>
					<SetupRow
						label="Intent"
						state={graph.setup_state?.intent}
						icon={Lightbulb}
					/>
					<SetupRow
						label="Skills"
						state={graph.setup_state?.skills}
						icon={Wand2}
					/>
					<SetupRow
						label="Datasets"
						state={graph.setup_state?.datasets}
						icon={Layers}
					/>
				</div>
			</div>
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

function SetupRow({
	label,
	state,
	icon: Icon,
}: {
	label: string;
	state: SetupSectionState | undefined;
	icon: typeof Database;
}) {
	const status = state?.completed_at
		? "done"
		: state?.skipped_at
			? "skipped"
			: "todo";
	const StatusIcon =
		status === "done"
			? CheckCircle2
			: status === "skipped"
				? SkipForward
				: Circle;
	const color =
		status === "done"
			? "text-green-500"
			: status === "skipped"
				? "text-muted-foreground"
				: "text-muted-foreground/60";
	return (
		<div className="flex items-center gap-2">
			<Icon className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
			<span className="flex-1 truncate">{label}</span>
			<StatusIcon className={`w-3.5 h-3.5 ${color}`} />
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
