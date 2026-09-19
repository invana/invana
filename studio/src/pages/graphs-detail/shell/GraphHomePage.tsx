/**
 * The graph page — what `mainSection` shows when nothing else is open, and the
 * surface setup is drawn on until the Graph is ready
 * (graph-detail-page.md G6 · G26).
 *
 * It is a **page**, not an empty state
 * (`docs/for-developers/building-studio/graph-detail-page.md` G6): it is always
 * in the strip, it cannot be closed, and it is never evicted. That matters
 * because six of the ten `leftNav` items open no page at all — Skills, Events,
 * Templates, Settings — and the region behind them has to say something true
 * rather than sit blank or, worse, keep drawing a canvas the panel has nothing
 * to do with.
 *
 * What it states is what a person needs to know they are in the right graph:
 * its name, whether the connection is live, and how much is in it. The closing
 * line is the one sentence the old `canvasEmptyHint` carried — phrased for
 * whichever `leftSection` is open, so "pick a model" is not read while looking
 * at a list of projects.
 */

import {
	useGraphConnectionQuery,
	useGraphQuery,
} from "@/hooks/queries/useGraphs";
import { OnboardingWizard } from "@/pages/graphs-detail/features/setup/OnboardingWizard";
import { useOnboarding } from "@/pages/graphs-detail/features/setup/useOnboarding";
import { hasOutstandingSetup } from "@/types/graphs";
import { PropertyList, PropertyRow, StatusDot } from "@invana/ui";

interface GraphHomePageProps {
	username: string;
	graphSlug: string;
	/** What to do next, in the vocabulary of the open `leftSection`. */
	hint: string;
}

export function GraphHomePage({
	username,
	graphSlug,
	hint,
}: GraphHomePageProps) {
	const { data: connection } = useGraphConnectionQuery(username, graphSlug);
	const { data: graph } = useGraphQuery(username, graphSlug);
	const { isOpen } = useOnboarding();

	// The wizard is what this page is *for* until the graph is ready (G26). It is
	// the page a new Graph lands on, it is never a modal over the thing it
	// configures, and it goes away on its own: it holds while any step is
	// outstanding, and a skipped step counts as resolved. What is left after that
	// is the identity card below — which graph am I in, and is the connection
	// live.
	//
	// It stays *reachable* once it is finished through the graduation cap in
	// `header.right` (SU19), which is also what re-opens it here: undoing a skip,
	// reading why a step broke and going over a concept again are things only the
	// wizard can do, and the Info panel's band is gone by then (G20).
	if (graph && (hasOutstandingSetup(graph) || isOpen)) {
		return (
			<OnboardingWizard
				graph={graph}
				username={username}
				graphSlug={graphSlug}
			/>
		);
	}

	// Only what the engine actually reports. There are no node/edge totals on the
	// Graph, and a page that invented them would be worse than one that omits
	// them (DS15) — the live counts belong to a canvas, and this page is not one.
	const live = connection?.status === "ACTIVE";

	return (
		<div className="flex h-full w-full flex-col items-center justify-center overflow-auto p-6">
			<div className="flex w-full max-w-sm flex-col gap-4">
				<div className="flex flex-col gap-1">
					<h1 className="truncate font-semibold text-lg">
						{graph?.name ?? graphSlug}
					</h1>
					<p className="flex items-center gap-2 text-meta text-muted-foreground">
						<StatusDot tone={live ? "success" : "muted"} />
						{connection ? connection.status : "NO CONNECTION"}
						{connection ? ` · ${connection.connector_class}` : null}
					</p>
				</div>

				<PropertyList>
					<PropertyRow label="owner">{username}</PropertyRow>
					<PropertyRow label="members">
						{graph?.member_count ?? "—"}
					</PropertyRow>
					<PropertyRow label="uri" mono>
						{connection?.uri ?? "—"}
					</PropertyRow>
				</PropertyList>

				<p className="text-muted-foreground text-sm">{hint}</p>
			</div>
		</div>
	);
}
