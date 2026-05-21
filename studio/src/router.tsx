import { Suspense, lazy } from "react";
import { Navigate, createBrowserRouter, useParams } from "react-router-dom";
import App from "./App";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { ErrorPage } from "./pages/ErrorPage";
import { LoginPage } from "./pages/auth/LoginPage";
import { RegisterPage } from "./pages/auth/RegisterPage";
import { GraphCreatePage } from "./pages/graphs/GraphCreatePage";
import { GraphOverviewPage } from "./pages/graphs/GraphOverviewPage";
import { GraphsListPage } from "./pages/graphs/GraphsListPage";
import { GraphConnectionSettingsPage } from "./pages/graphs/settings/GraphConnectionSettingsPage";
import { GraphIntentSettingsPage } from "./pages/graphs/settings/GraphIntentSettingsPage";
import { GraphLLMsSettingsPage } from "./pages/graphs/settings/GraphLLMsSettingsPage";
import { GraphSectionPlaceholderPage } from "./pages/graphs/settings/GraphSectionPlaceholderPage";
import { GraphSettingsPage } from "./pages/graphs/settings/GraphSettingsPage";
import { ProfileSettingsPage } from "./pages/settings/ProfileSettingsPage";

// Tiny redirector for legacy /settings/<section> deep-links (members +
// invitations) that no longer have a full-page form — those sections live
// exclusively in the docked SettingsPanel now. Preserves deep-linkability
// by opening the panel on the graph overview with ?settings=<section>.
function SettingsPanelRedirect({
	section,
}: {
	section: "members" | "invitations";
}) {
	const { username, graphSlug } = useParams<{
		username: string;
		graphSlug: string;
	}>();
	if (!username || !graphSlug) return <Navigate to="/" replace />;
	return (
		<Navigate to={`/u/${username}/${graphSlug}?settings=${section}`} replace />
	);
}

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
	// Public auth pages — no shell, no protection.
	{ path: "/login", element: <LoginPage />, errorElement: <ErrorPage /> },
	{
		path: "/register",
		element: <RegisterPage />,
		errorElement: <ErrorPage />,
	},

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

			// Graph container — settings full-page routes (maximize targets).
			// The Overview itself lives at the top level so it owns AppLayoutV2.
			{
				path: "u/:username/:graphSlug/settings",
				element: <GraphSettingsPage />,
			},
			{
				path: "u/:username/:graphSlug/settings/connection",
				element: <GraphConnectionSettingsPage />,
			},
			{
				path: "u/:username/:graphSlug/settings/intent",
				element: <GraphIntentSettingsPage />,
			},
			// Members + Invitations have no full-page form anymore — they live only
			// in the docked SettingsPanel. Keep the URLs as redirects so existing
			// deep-links continue to work.
			{
				path: "u/:username/:graphSlug/settings/members",
				element: <SettingsPanelRedirect section="members" />,
			},
			{
				path: "u/:username/:graphSlug/settings/invitations",
				element: <SettingsPanelRedirect section="invitations" />,
			},
			{
				path: "u/:username/:graphSlug/settings/llms",
				element: <GraphLLMsSettingsPage />,
			},
			{
				path: "u/:username/:graphSlug/settings/skills",
				element: (
					<GraphSectionPlaceholderPage
						title="Skills"
						description="Define the skills available to agents querying this graph."
						slice="S5"
					/>
				),
			},
			{
				path: "u/:username/:graphSlug/settings/datasets",
				element: (
					<GraphSectionPlaceholderPage
						title="Datasets"
						description="Import data into this knowledge graph."
						slice="S6"
					/>
				),
			},

			{ path: "*", element: <ErrorPage /> },
		],
	},
]);
