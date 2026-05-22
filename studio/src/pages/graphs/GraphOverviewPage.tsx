import { AppLayoutV2 } from "@invana/themes";
import { Button, Skeleton } from "@invana/ui";
import { ArrowRight, FileText, GitGraph, Network } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { useAppHeader } from "../../components/header/useAppHeader";
import { SettingsPanel } from "../../components/settings/SettingsPanel";
import { useGraphLeftNav } from "../../components/settings/useGraphLeftNav";
import { useSettingsPanel } from "../../components/settings/useSettingsPanel";
import { useGraphQuery } from "../../hooks/queries/useGraphs";

export function GraphOverviewPage() {
	const { username, graphSlug } = useParams<{
		username: string;
		graphSlug: string;
	}>();
	const navigate = useNavigate();
	const {
		data: graph,
		isLoading,
		isError,
		error,
	} = useGraphQuery(username, graphSlug);
	const settingsPanel = useSettingsPanel();
	const leftNav = useGraphLeftNav(username ?? "", graphSlug ?? "", "overview");
	const header = useAppHeader({ pageLabel: "Overview" });

	// Required wizard sections must be completed for Modeller/Explorer/Query
	// to function. The wizard itself lives in the Info section now; we only
	// need the boolean to gate the quick-action buttons below.
	const setupComplete =
		!!graph &&
		!!graph.setup_state?.graph_info?.completed_at &&
		!!graph.setup_state?.intent?.completed_at;

	// ── Main content ─────────────────────────────────────────────────────────
	let mainContent: React.ReactNode;
	if (isLoading) {
		mainContent = (
			<div className="h-full overflow-auto">
				<div className="max-w-3xl mx-auto px-10 py-12">
					<Skeleton className="h-10 w-72 mb-2" />
					<Skeleton className="h-5 w-96 mb-10" />
					<Skeleton className="h-64 w-full" />
				</div>
			</div>
		);
	} else if (isError || !graph) {
		mainContent = (
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
	} else {
		mainContent = (
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

					{/* Setup progress + edit actions live in the Info section now
					    (rail icon · Info). When setup isn't complete, deep-link
					    users into that panel so they can start without hunting. */}
					{!setupComplete && (
						<div className="border border-border rounded-lg p-4 mb-10 flex items-center justify-between gap-4">
							<div>
								<p className="font-medium">Setup isn't complete yet.</p>
								<p className="text-muted-foreground">
									Finish Graph Info + Intent to unlock Modeller, Explorer, and
									Query.
								</p>
							</div>
							<Button
								variant="default"
								size="sm"
								onClick={() => settingsPanel.setSection("info")}
							>
								Open setup
								<ArrowRight className="w-3.5 h-3.5 ml-1" />
							</Button>
						</div>
					)}

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
								<div className="text-muted-foreground">
									Run Cypher / Gremlin
								</div>
							</div>
						</Button>
					</div>
				</div>
			</div>
		);
	}

	const settingsOpen = settingsPanel.isOpen && !!username && !!graphSlug;
	const settingsExpanded = settingsOpen && settingsPanel.expanded;
	const showSettingsInLeft = settingsOpen && !settingsPanel.expanded;

	return (
		<AppLayoutV2
			leftNav={leftNav}
			header={header}
			leftSection={
				showSettingsInLeft
					? {
							defaultSize: "420px",
							minSize: "320px",
							maxSize: "640px",
							collapsible: false,
							content: (
								<SettingsPanel
									username={username as string}
									graphSlug={graphSlug as string}
								/>
							),
						}
					: undefined
			}
			mainSection={{
				defaultSize: "800px",
				minSize: "400px",
				content: settingsExpanded ? (
					<SettingsPanel
						username={username as string}
						graphSlug={graphSlug as string}
					/>
				) : (
					mainContent
				),
			}}
		/>
	);
}
