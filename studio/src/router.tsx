import { Suspense, lazy } from "react";
import { Navigate, createBrowserRouter } from "react-router-dom";
import App from "./App";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { ErrorPage } from "./pages/ErrorPage";
import { LoginPage } from "./pages/auth/LoginPage";
import { GraphCreatePage } from "./pages/graphs/GraphCreatePage";
import { GraphOverviewPage } from "./pages/graphs/GraphOverviewPage";
import { GraphsListPage } from "./pages/graphs/GraphsListPage";
import { PlatformEventsPage } from "./pages/platform/PlatformEventsPage";
import { ProfileSettingsPage } from "./pages/settings/ProfileSettingsPage";

// Lazy-loaded — Explorer/Modeller carry the heaviest UI (graph rendering once
// the new canvas integration lands). Lazy keeps the auth + settings flows
// snappy and isolates any canvas-side regressions to their own chunks.
const ExplorerPage = lazy(() =>
	import("./pages/graphs/explorer/ExplorerPage").then((m) => ({
		default: m.ExplorerPage,
	})),
);
const ModellerPage = lazy(() =>
	import("./pages/graphs/modeller/ModellerPage").then((m) => ({
		default: m.ModellerPage,
	})),
);

const LazyFallback = () => (
	<div className="p-8 text-muted-foreground">Loading…</div>
);

export const router = createBrowserRouter([
	// Public auth pages — no shell, no protection. Self-service registration was
	// removed (RFC-023): accounts are superuser-provisioned, so there is no
	// public /register page — only /login.
	{ path: "/login", element: <LoginPage />, errorElement: <ErrorPage /> },

	// Full-page layouts — own AppLayoutV2, not nested under App shell.
	// Graph-scoped URLs (RFC-017). Explorer/Modeller hit the graph-scoped
	// /u/:username/:graphSlug/* surface end-to-end (connection, query, schema,
	// introspect).
	{
		path: "u/:username/:graphSlug/modeller",
		element: (
			<ProtectedRoute>
				<Suspense fallback={<LazyFallback />}>
					<ModellerPage />
				</Suspense>
			</ProtectedRoute>
		),
		errorElement: <ErrorPage />,
	},
	{
		path: "u/:username/:graphSlug/explorer",
		element: (
			<ProtectedRoute>
				<Suspense fallback={<LazyFallback />}>
					<ExplorerPage />
				</Suspense>
			</ProtectedRoute>
		),
		errorElement: <ErrorPage />,
	},
	{
		path: "u/:username/:graphSlug",
		element: (
			<ProtectedRoute>
				<GraphOverviewPage />
			</ProtectedRoute>
		),
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
