/**
 * The routes on a Graph that no product owns: the Graph's own URL and
 * Activity. The app mounts them under `<StudioShell>` beside the products'
 * routes (migration-plan §5).
 *
 * - `/u/:user/:graph` opens the product this browser last had open on a
 *   Graph, else Explorer, carrying the query string across — so `?right=`,
 *   `?page=` and `?onboarding=` land in the product.
 * - `/u/:user/:graph/activity/<tab>[/:run]` is the shell's Activity page, and
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
	useNavigate,
} from "react-router-dom";
import { ActivityPage } from "./activity/ActivityPage";
import { activityOf, changesPath } from "./activity/activityPath";
import {
	historyKey,
	type RecordHistory,
	type RecordKind,
} from "./activity/changes/history";
import { runAddress } from "./activity/runs/boards/runBoards";
import { boardPageId } from "./boards/boardKinds";
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
import { useLeftSection } from "./regions/useLeftSection";

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

/** Activity on the open Graph, at the tab (and run) its path names. */
function ActivityRoute() {
	const { pathname } = useLocation();
	const navigate = useNavigate();
	const graph = useOpenGraph();
	const { setSection } = useLeftSection();
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
			onRetune={() => setSection("govern")}
			// The compare board is a Workbook page, so it opens in a product.
			onCompare={(runId, other) =>
				navigate(
					`/u/${username}/${graphSlug}?page=${encodeURIComponent(
						boardPageId("compare", `${runId}:${other}`),
					)}`,
				)
			}
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

/**
 * A section whose records drill in one level down: `runs` › `<run>`. `named`
 * shortens the record's crumb — a run's UUID reads as `run:740a2f58` — and the
 * full id stays on hover.
 */
function drillable(
	path: string,
	label: string,
	param: string,
	named: (id: string) => string,
): RouteObject {
	const record: RouteObject = {
		path: `:${param}`,
		handle: {
			crumb: (p) => (p[param] ? named(p[param]) : undefined),
			crumbTitle: (p) => p[param],
		} satisfies ShellRouteHandle,
	};
	return level(path, label, [record]);
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
					level("approvals", "Approvals"),
					drillable("runs", "Runs", "run", runAddress),
					level("schedules", "Schedules"),
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
