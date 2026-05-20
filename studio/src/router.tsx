import { Suspense, lazy } from "react";
import { Navigate, createBrowserRouter } from "react-router-dom";
import App from "./App";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { ErrorPage } from "./pages/ErrorPage";
import { LoginPage } from "./pages/auth/LoginPage";
import { RegisterPage } from "./pages/auth/RegisterPage";
import { GraphCreatePage } from "./pages/graphs/GraphCreatePage";
import { GraphEditPage } from "./pages/graphs/GraphEditPage";
import { GraphsListPage } from "./pages/graphs/GraphsListPage";
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
			{ path: "graphs/:id/edit", element: <GraphEditPage /> },
			{ path: "settings/profile", element: <ProfileSettingsPage /> },
			{
				path: "u/:username/:slug/settings/members",
				element: <GraphMembersPage />,
			},
			{
				path: "u/:username/:slug/settings/invitations",
				element: <GraphInvitationsPage />,
			},
			{ path: "*", element: <ErrorPage /> },
		],
	},
]);
