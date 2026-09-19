import { useGraphQuery } from "@/hooks/queries/useGraphs";
import { RecentSessions } from "@/pages/graphs-detail/features/graph-settings/RecentSessions";
import { SetupTimeline } from "@/pages/graphs-detail/features/setup/SetupTimeline";
import { useRightSection } from "@/pages/graphs-detail/shell/useRightSection";
import { useSettingsPanel } from "@/pages/graphs-detail/shell/useSettingsPanel";
import { isSetupComplete } from "@/types/graphs";
import { Badge, Button, Skeleton } from "@invana/ui";
import { useCallback } from "react";

interface Props {
	username: string;
	graphSlug: string;
}

/**
 * The graph info panel — which graph am I in, and is it ready?
 * (graph-detail-page.md G20.)
 *
 * Three bands and nothing else:
 *
 * 1. **Identity** — the graph's name and what it is for. Not the owner and slug:
 *    the breadcrumb above the panel already reads `owner › graph`, and a panel
 *    that repeats its own header twice in three lines is saying nothing twice.
 *    Not the connection either — the URI and the latency are the footer's
 *    `ConnectionStatusBar`, which is on screen whatever panel is open, and
 *    whether a database is attached at all is the setup timeline's first step.
 * 2. **Setup** — only while the required steps are unfinished, drawn as a
 *    timeline off what the engine derived (connect-and-model/spec.md CM8). It
 *    disappears the moment the graph is ready.
 * 3. **Recent sessions** — what has been happening here.
 *
 * What it used to carry and no longer does: counts of LLM providers, Skills and
 * Members as three number cards. Each of those has its own panel one click
 * away, and a number with no row under it is trivia — it fills the panel
 * without telling anyone what to do next. Editing lives in Settings; the
 * connection's fields live in its own group there.
 */
export function GraphInfoPanel({ username, graphSlug }: Props) {
	const { data: graph, isLoading } = useGraphQuery(username, graphSlug);
	const { setSection } = useSettingsPanel();
	const right = useRightSection();

	const openAssistant = useCallback(() => right.open("assistant"), [right]);

	if (isLoading) {
		return (
			<div className="flex flex-col gap-4">
				<Skeleton className="h-10 w-3/4" />
				<Skeleton className="h-28 w-full" />
				<Skeleton className="h-32 w-full" />
			</div>
		);
	}
	if (!graph) {
		return <p className="text-muted-foreground">Graph not found.</p>;
	}

	const archived = graph.status === "archived";
	const ready = isSetupComplete(graph);

	return (
		<div className="flex flex-col gap-5">
			{/* ── Identity ─────────────────────────────────────────────────────── */}
			<header className="flex min-w-0 flex-col gap-1">
				<h2 className="flex items-center gap-2 font-semibold text-lg">
					<span className="min-w-0 truncate">{graph.name}</span>
					{archived && <Badge variant="outline">Archived</Badge>}
				</h2>
				{graph.description ? (
					<p className="text-muted-foreground">{graph.description}</p>
				) : (
					// A missing description is a thing to fix, not a blank — the panel
					// says so rather than closing the gap silently.
					<Button
						variant="link"
						size="sm"
						className="h-auto justify-start p-0 text-muted-foreground"
						onClick={() => setSection("settings")}
					>
						Add a description
					</Button>
				)}
			</header>

			{/* ── Setup, while it is unfinished ────────────────────────────────── */}
			{!ready && <SetupTimeline graph={graph} />}

			{/* ── Recent sessions ──────────────────────────────────────────────── */}
			<RecentSessions
				username={username}
				graphSlug={graphSlug}
				onOpenAssistant={openAssistant}
			/>
		</div>
	);
}
