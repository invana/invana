import { Skeleton } from "@invana/ui";
import {
	ArrowLeft,
	ArrowRight,
	Database,
	Layers,
	Lightbulb,
	Mail,
	Sparkles,
	Users,
} from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useGraphQuery } from "../../../hooks/queries/useGraphs";
import { useAuth } from "../../../hooks/useAuth";

interface Section {
	key: string;
	label: string;
	description: string;
	icon: typeof Database;
	subpath: string;
	adminOnly?: boolean;
}

const SECTIONS: Section[] = [
	{
		key: "connection",
		label: "Connection",
		description: "Database URI, credentials, read-only mode.",
		icon: Database,
		subpath: "connection",
		adminOnly: true,
	},
	{
		key: "intent",
		label: "Intent",
		description: "What this Graph is for and what it should answer.",
		icon: Lightbulb,
		subpath: "intent",
		adminOnly: true,
	},
	{
		key: "skills",
		label: "Skills",
		description: "What the Graph's agents can do. (S5)",
		icon: Sparkles,
		subpath: "skills",
		adminOnly: true,
	},
	{
		key: "datasets",
		label: "Datasets",
		description: "Import data into the knowledge graph. (S6)",
		icon: Layers,
		subpath: "datasets",
		adminOnly: true,
	},
	{
		key: "members",
		label: "Members",
		description: "Who can access this Graph and their roles.",
		icon: Users,
		subpath: "members",
	},
	{
		key: "invitations",
		label: "Invitations",
		description: "Invite developers and analysts to this Graph.",
		icon: Mail,
		subpath: "invitations",
		adminOnly: true,
	},
];

export function GraphSettingsPage() {
	const { username, graphSlug } = useParams<{
		username: string;
		graphSlug: string;
	}>();
	const navigate = useNavigate();
	const { data: graph, isLoading } = useGraphQuery(username, graphSlug);
	const { rolesForGraph } = useAuth();
	const { isAdmin } = rolesForGraph(username, graphSlug);

	const backToOverview = () => navigate(`/u/${username}/${graphSlug}`);

	const visible = SECTIONS.filter((s) => !s.adminOnly || isAdmin);

	return (
		<div className="h-full overflow-auto">
			<div className="max-w-3xl mx-auto px-10 py-12">
				<button
					type="button"
					onClick={backToOverview}
					className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors mb-8"
				>
					<ArrowLeft className="w-4 h-4" />
					<span>Back to overview</span>
				</button>

				<div className="mb-8">
					<p className="text-muted-foreground font-mono">
						/u/{username}/{graphSlug} · settings
					</p>
					{isLoading ? (
						<Skeleton className="h-8 w-64 mt-2" />
					) : (
						<h1 className="text-2xl font-bold mt-1">
							{graph?.name ?? "Graph"} settings
						</h1>
					)}
				</div>

				<div className="border border-border rounded-lg divide-y divide-border">
					{visible.map((s) => {
						const Icon = s.icon;
						return (
							<Link
								key={s.key}
								to={`/u/${username}/${graphSlug}/settings/${s.subpath}`}
								className="flex items-center gap-4 px-5 py-4 hover:bg-accent transition-colors group"
							>
								<Icon className="w-5 h-5 text-muted-foreground shrink-0" />
								<div className="flex-1 min-w-0">
									<p className="font-medium">{s.label}</p>
									<p className="text-muted-foreground">{s.description}</p>
								</div>
								<ArrowRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
							</Link>
						);
					})}
				</div>
			</div>
		</div>
	);
}
