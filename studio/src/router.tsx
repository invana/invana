import App from "@/App";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { ErrorPage } from "@/pages/ErrorPage";
import { LoginPage } from "@/pages/auth/LoginPage";
import { GraphCreatePage } from "@/pages/graphs/GraphCreatePage";
import { GraphsListPage } from "@/pages/graphs/GraphsListPage";
import { PlatformEventsPage } from "@/pages/platform/PlatformEventsPage";
import { ProfileSettingsPage } from "@/pages/settings/ProfileSettingsPage";
import { Suspense, lazy } from "react";
import {
	Navigate,
	createBrowserRouter,
	useLocation,
	useParams,
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
 * The retired screen names — `/explorer` and `/modeller` — pointing back at the
 * graph's own URL (graph-detail-page.md G15).
 *
 * The query string is carried across, and that is the whole reason these are
 * components rather than a static `<Navigate to>`: a bookmark is a URL *plus*
 * its params, so dropping `?panel=agents` would land the reader on an empty
 * state instead of the thing the link was about. The legacy `?settings=` name
 * rides along untouched — `useSettingsPanel` still reads it (G16).
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

export const router = createBrowserRouter([
	// Public auth pages — no shell, no protection. Self-service registration was
	// removed (docs/for-developers/modules/identity-and-access/features/membership.md): accounts are superuser-provisioned, so there is no
	// public /register page — only /login.
	{ path: "/login", element: <LoginPage />, errorElement: <ErrorPage /> },

	// Full-page layouts — own AppLayoutV2, not nested under App shell.
	// Graph-scoped URLs (docs/for-developers/modules/identity-and-access/spec.md).
	// The graph's own URL is the page (graph-detail-page.md G15): everything on it
	// is a `leftNav` item or an open page, and both are query params.
	{
		path: "u/:username/:graphSlug",
		element: (
			<ProtectedRoute>
				<Suspense fallback={<LazyFallback />}>
					<GraphDetailPage />
				</Suspense>
			</ProtectedRoute>
		),
		errorElement: <ErrorPage />,
	},
	{
		// `/explorer` named the page after one of its ten `leftNav` items. It
		// shipped and it is bookmarked, so it redirects rather than 404s.
		path: "u/:username/:graphSlug/explorer",
		element: <RedirectToGraphRoot />,
		errorElement: <ErrorPage />,
	},
	{
		// docs/for-developers/modules/explore/spec.md retired the separate Modeller page — the model is a canvas
		// kind on the one page now, so the bookmark lands on the panel it meant.
		path: "u/:username/:graphSlug/modeller",
		element: <RedirectToGraphRoot openPanel="model" />,
		errorElement: <ErrorPage />,
	},

	// App shell layout — gated by ProtectedRoute.
	{
		path: "/",
		element: (
			<ProtectedRoute>
				<App />
			</ProtectedRoute>
		),
		errorElement: <ErrorPage />,
		children: [
			{ index: true, element: <Navigate to="/graphs" replace /> },
			{ path: "graphs", element: <GraphsListPage /> },
			{ path: "graphs/new", element: <GraphCreatePage /> },
			{ path: "settings/profile", element: <ProfileSettingsPage /> },
			// Platform-admin surfaces (superuser-only — gated inside the page
			// component via a direct user.is_superuser check). Lives under
			// /platform/* to avoid the /admin namespace collision with starlette-admin.
			{ path: "platform/events", element: <PlatformEventsPage /> },

			{ path: "*", element: <ErrorPage /> },
		],
	},
]);
