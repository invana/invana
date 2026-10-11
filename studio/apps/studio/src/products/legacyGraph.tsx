/**
 * `legacy-graph` — today's graph page, registered as one product so the app
 * composes it through the product contract like any other. It is temporary:
 * each of its panels moves into its own product, and when the last one has
 * moved the page and this definition are deleted.
 *
 * The page draws every region itself from its own URL state (`?panel=`,
 * `?right=`), so its routes say `ownsRegions` and its `nav` is `null` — the
 * `leftNav` is the page's, not a list of product routes. The two retired screen
 * names, `/explorer` and `/modeller`, still redirect to the graph's own URL.
 */
import type { ProductDefinition } from "@invana-studio/core";
import { ErrorPage, type ShellRouteHandle } from "@invana-studio/shell";
import { Network } from "lucide-react";
import { lazy, Suspense } from "react";
import { Navigate, useLocation, useParams } from "react-router-dom";

// Lazy-loaded — the graph page carries the heaviest UI (graph rendering). Lazy
// keeps the auth + settings flows snappy and isolates any canvas-side
// regressions to their own chunk.
const GraphDetailPage = lazy(() =>
	import("@/pages/graphs-detail/GraphDetailPage").then((m) => ({
		default: m.GraphDetailPage,
	})),
);
const LazyFallback = () => (
	<div className="p-8 text-muted-foreground">Loading…</div>
);

/**
 * The retired screen names — `/explorer` and `/modeller` — pointing back at the
 * graph's own URL (graph-detail-page.md).
 *
 * The query string is carried across, and that is the whole reason these are
 * components rather than a static `<Navigate to>`: a bookmark is a URL *plus*
 * its params, so dropping `?panel=agents` would land the reader on an empty
 * state instead of the thing the link was about. The legacy `?settings=` name
 * rides along untouched — `useLeftSection` still reads it.
 */
function RedirectToGraphRoot({ openPanel }: { openPanel?: string }) {
	const { username, graphSlug } = useParams();
	const { search } = useLocation();
	const params = new URLSearchParams(search);
	if (openPanel) params.set("panel", openPanel);
	const query = params.toString();
	return (
		<Navigate
			to={{
				pathname: `/u/${username}/${graphSlug}`,
				search: query ? `?${query}` : "",
			}}
			replace
		/>
	);
}

const ownsRegions: ShellRouteHandle = { ownsRegions: true };

export const legacyGraph: ProductDefinition = {
	id: "legacy-graph",
	name: "Studio",
	tagline: "The graph page, every panel in one place",
	icon: Network,
	scope: "graph",
	landing: "",
	nav: null,
	routes: [
		// The graph's own URL is the page (graph-detail-page.md): everything on
		// it is a `leftNav` item or an open page, and both are query params.
		{
			path: "u/:username/:graphSlug",
			handle: ownsRegions,
			element: (
				<Suspense fallback={<LazyFallback />}>
					<GraphDetailPage />
				</Suspense>
			),
			errorElement: <ErrorPage />,
		},
		{
			// `/explorer` named the page after one of its ten `leftNav` items. It
			// shipped and it is bookmarked, so it redirects rather than 404s.
			path: "u/:username/:graphSlug/explorer",
			handle: ownsRegions,
			element: <RedirectToGraphRoot />,
			errorElement: <ErrorPage />,
		},
		{
			// docs/for-developers/modules/explore/spec.md retired the separate
			// Modeller page — the model is a canvas kind on the one page now, so
			// the bookmark lands on the panel it meant.
			path: "u/:username/:graphSlug/modeller",
			handle: ownsRegions,
			element: <RedirectToGraphRoot openPanel="model" />,
			errorElement: <ErrorPage />,
		},
	],
};
