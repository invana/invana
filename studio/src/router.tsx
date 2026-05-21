import { Suspense, lazy } from "react";
import { Navigate, createBrowserRouter } from "react-router-dom";
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
import { GraphSectionPlaceholderPage } from "./pages/graphs/settings/GraphSectionPlaceholderPage";
import { GraphInvitationsPage } from "./pages/settings/GraphInvitationsPage";
import { GraphMembersPage } from "./pages/settings/GraphMembersPage";
import { ProfileSettingsPage } from "./pages/settings/ProfileSettingsPage";

// Lazy-loaded — these import @invana/canvas-core which is currently broken on
// this branch. Keeping them lazy means the auth + settings flows don't break
// even when canvas imports can't resolve.
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
	// Modeller + Explorer keep their legacy /graphs/:id/* URLs in this S2 pass.
	// Re-mounting them under /u/:username/:slug/{modeller,explorer} is a follow-up
	// that needs the FE pages to switch from connection_id-keyed APIs to the
	// graph-scoped ones (then the legacy_query / legacy_schemas shims can go).
	{
		path: "graphs/:id/modeller",
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
		path: "graphs/:id/explorer",
		element: (
			<ProtectedRoute>
				<Suspense fallback={<LazyFallback />}>
					<ExplorerPage />
				</Suspense>
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

			// Graph container — overview + settings.
			{ path: "u/:username/:slug", element: <GraphOverviewPage /> },
			{
				path: "u/:username/:slug/settings/connection",
				element: <GraphConnectionSettingsPage />,
			},
			{
				path: "u/:username/:slug/settings/intent",
				element: <GraphIntentSettingsPage />,
			},
			{
				path: "u/:username/:slug/settings/members",
				element: <GraphMembersPage />,
			},
			{
				path: "u/:username/:slug/settings/invitations",
				element: <GraphInvitationsPage />,
			},
			{
				path: "u/:username/:slug/settings/skills",
				element: (
					<GraphSectionPlaceholderPage
						title="Skills"
						description="Define the skills available to agents querying this graph."
						slice="S5"
					/>
				),
			},
			{
				path: "u/:username/:slug/settings/datasets",
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
