/**
 * `legacy-graph` — today's graph page, registered as one product so the app
 * composes it through the product contract like any other. It is temporary:
 * each of its panels moves into its own product, and when the last one has
 * moved the page and this definition are deleted.
 *
 * The page draws every region itself, so its routes say `ownsRegions` and its
 * `nav` is `null` — the `leftNav` is the page's, not a list of product routes.
 *
 * **Every panel has a path**, under the product that will own it
 * (migration-plan §5): `/u/:user/:graph/activity/runs/<id>`. The Explorer's,
 * the Modeller's and the Agents product's paths are their own products'
 * routes, which draw this page through their slots.
 * The Graph's route renders the page once, and the paths below it are routes
 * with no element of their own — they exist to match (anything else under the
 * Graph is a 404) and to name each level for the breadcrumbs through
 * `handle.crumb`. Moving between panels never remounts the page. The page
 * reads its panel off the path (`panelPaths`), so a reload lands on the same
 * screen.
 *
 * An old link — `?panel=`, `?settings=`, `?drawer=`, or a product's bare root —
 * is redirected to its path before the page renders.
 */
import type { ProductDefinition } from "@invana-studio/core";
import {
	canonicalRedirect,
	ErrorPage,
	runAddress,
	type ShellRouteHandle,
} from "@invana-studio/shell";
import { Network } from "lucide-react";
import { lazy, Suspense } from "react";
import {
	Navigate,
	type Params,
	type RouteObject,
	useLocation,
} from "react-router-dom";

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
 * The graph page, after any old link is sent to its path. Explorer's routes
 * draw it too, through `ExplorerSlotsContext`, until the page is retired.
 */
export function GraphPageRoute() {
	const { pathname, search } = useLocation();
	const target = canonicalRedirect(pathname, search);
	if (target) return <Navigate to={target} replace />;
	return (
		<Suspense fallback={<LazyFallback />}>
			<GraphDetailPage />
		</Suspense>
	);
}

/** A level of the trail: a fixed label, or the drill-in's id. */
function level(
	path: string,
	crumb: string | ((params: Params) => string | undefined),
	children?: RouteObject[],
): RouteObject {
	const handle: ShellRouteHandle = { crumb };
	return children
		? { path, handle, children: [{ index: true }, ...children] }
		: { path, handle };
}

/**
 * A section whose records drill in one level down: `runs` › `<run>`. `named`
 * shortens the record's crumb — a run's UUID reads as `run:740a2f58` — and the
 * full id stays on hover.
 */
function drillable(
	path: string,
	label: string,
	param: string,
	named?: (id: string) => string,
): RouteObject {
	const record: RouteObject = named
		? {
				path: `:${param}`,
				handle: {
					crumb: (p) => (p[param] ? named(p[param]) : undefined),
					crumbTitle: (p) => p[param],
				} satisfies ShellRouteHandle,
			}
		: level(`:${param}`, (p) => p[param]);
	return level(path, label, [record]);
}

export const legacyGraph: ProductDefinition = {
	id: "legacy-graph",
	name: "Studio",
	tagline: "The graph page, every panel in one place",
	icon: Network,
	scope: "graph",
	landing: "",
	nav: null,
	routes: [
		{
			path: "u/:username/:graphSlug",
			handle: { ownsRegions: true } satisfies ShellRouteHandle,
			element: <GraphPageRoute />,
			errorElement: <ErrorPage />,
			children: [
				{ index: true },
				level("activity", "Activity", [
					level("inbox", "Inbox"),
					level("approvals", "Approvals"),
					drillable("runs", "Runs", "run", runAddress),
					level("schedules", "Schedules"),
					level("events", "Events"),
					level("rules", "Rules"),
					level("channels", "Channels"),
				]),
				level("projects", "Projects", [
					drillable("todos", "Todos", "todo"),
					level(":project", (p) => p.project),
				]),
			],
		},
	],
};
