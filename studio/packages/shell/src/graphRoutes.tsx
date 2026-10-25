/**
 * The routes on a Graph that no product owns: the Graph's own URL and
 * Activity. The app mounts them under `<StudioShell>` beside the products'
 * routes (migration-plan §5).
 *
 * - `/u/:user/:graph` opens the product this browser last had open on a
 *   Graph, else Explorer, carrying the query string across — so `?right=`,
 *   `?page=` and `?onboarding=` land in the product.
 * - `/u/:user/:graph/activity/<tab>[/:run | /:schedule]` is the shell's Activity page, and
 *   `/activity/changes/<kind>/<record>` a change's compare inside it; the bare
 *   `/activity/changes` is the change log, Events with its Changes filter.
 *   Its levels are routes with no element of their own: they exist to match
 *   (anything else under Activity is a 404) and to name each level for the
 *   breadcrumbs through `handle.crumb`.
 *
 * Every route on a Graph first sends an old link — `?panel=`, `?settings=`,
 * `?drawer=`, a product's bare root — to its path (`<CanonicalRoute>`). The
 * redirect table is `regions/panelPaths`, and it stays for good: bookmarks
 * outlive the page they were made on.
 */
import type { ReactNode } from "react";
import {
	Navigate,
	type Params,
	type RouteObject,
	useLocation,
} from "react-router-dom";
import { ActivityPage } from "./activity/ActivityPage";
import { activityOf, changesPath } from "./activity/activityPath";
import {
	historyKey,
	type RecordHistory,
	type RecordKind,
} from "./activity/changes/history";
import { scheduleKeys } from "./activity/schedules/queries";
import type { Schedule } from "./activity/schedules/types";
import { lastProduct } from "./lastProduct";
import { ErrorPage } from "./pages/ErrorPage";
import {
	joinPath,
	productBase,
	type ShellRouteHandle,
	useOpenGraph,
	useProducts,
} from "./products";
import { canonicalRedirect } from "./regions/panelPaths";

/**
 * Renders its children once the location is canonical; an old link on a Graph
 * is replaced by its path first. Off a Graph it renders the children as is.
 */
export function CanonicalRoute({ children }: { children: ReactNode }) {
	const { pathname, search } = useLocation();
	const target = canonicalRedirect(pathname, search);
	return target ? <Navigate to={target} replace /> : children;
}

/** The Graph's own URL: the last graph product, else Explorer. */
function GraphRoot() {
	const { search } = useLocation();
	const graph = useOpenGraph();
	const products = useProducts().filter((p) => p.scope === "graph");
	const remembered = lastProduct();
	const product =
		products.find((p) => p.id === remembered) ??
		products.find((p) => p.id === "explorer") ??
		products[0];
	const base = product && productBase(product, graph);
	if (!product || !base) return <ErrorPage />;
	return (
		<Navigate to={`${joinPath(base, product.landing)}${search}`} replace />
	);
}

/** Activity on the open Graph, at the tab (and schedule) its path names. */
function ActivityRoute() {
	const { pathname } = useLocation();
	const graph = useOpenGraph();
	const location = activityOf(pathname);
	if (graph && /\/activity\/changes\/?$/.test(pathname))
		return <Navigate to={changesPath(graph)} replace />;
	if (!graph || !location) return null;
	const { username, graphSlug } = graph;
	return (
		<ActivityPage
			username={username}
			graphSlug={graphSlug}
			location={location}
		/>
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

/** A UUID reads by its first block; a key (a plan's) is already short. */
const shortId = (id: string) =>
	/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(id) ? id.slice(0, 8) : id;

export const graphRoutes: RouteObject[] = [
	{
		path: "u/:username/:graphSlug",
		errorElement: <ErrorPage />,
		children: [
			{
				index: true,
				element: (
					<CanonicalRoute>
						<GraphRoot />
					</CanonicalRoute>
				),
			},
			{
				...level("activity", "Activity", [
					level("inbox", "Inbox"),
					level("runs", "Runs"),
					level("schedules", "Schedules", [
						{
							path: ":schedule",
							handle: {
								// The schedule's name once its page has read it; its id until then.
								crumb: (p) => p.schedule && shortId(p.schedule),
								crumbTitle: (p) => p.schedule,
								crumbFrom: (p) =>
									p.username && p.graphSlug && p.schedule
										? {
												queryKey: scheduleKeys.one(
													{ username: p.username, graphSlug: p.graphSlug },
													p.schedule,
												),
												label: (data) => (data as Schedule).name,
											}
										: undefined,
							} satisfies ShellRouteHandle,
						},
					]),
					level("events", "Events"),
					level("changes", "Changes", [
						{
							path: ":kind/:record",
							handle: {
								// The record's name once the page has read it; its id until then.
								crumb: (p) => p.record && `${p.kind}:${shortId(p.record)}`,
								crumbTitle: (p) => p.record,
								crumbFrom: (p) =>
									p.username && p.graphSlug && p.kind && p.record
										? {
												queryKey: historyKey(
													{ username: p.username, graphSlug: p.graphSlug },
													p.kind as RecordKind,
													p.record,
												),
												label: (data) => (data as RecordHistory).name,
											}
										: undefined,
							} satisfies ShellRouteHandle,
						},
					]),
					level("rules", "Rules"),
					level("channels", "Channels"),
				]),
				element: (
					<CanonicalRoute>
						<ActivityRoute />
					</CanonicalRoute>
				),
			},
		],
	},
];
