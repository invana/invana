import { AgentsSlotsContext } from "@invana-studio/agents";
import { ExplorerSlotsContext } from "@invana-studio/explorer";
import { ModellerSlotsContext } from "@invana-studio/modeller";
import {
	ErrorPage,
	GraphCreatePage,
	GraphsListPage,
	LoginPage,
	PlatformEventsPage,
	ProfileSettingsPage,
	ProtectedRoute,
	productRoutes,
	StudioShell,
} from "@invana-studio/shell";
import { createBrowserRouter, Navigate } from "react-router-dom";
import { products } from "@/products";
import { GraphPageRoute } from "@/products/legacyGraph";
import { modellerSlots } from "@/products/modellerSlots";

// The Explorer's, the Modeller's and the Agents product's routes draw today's
// graph page until it is retired.
const explorerSlots = { Page: GraphPageRoute };
const agentsSlots = { Page: GraphPageRoute };

export const router = createBrowserRouter([
	// Public auth pages — no shell, no protection. Self-service registration was
	// removed (docs/for-developers/modules/identity-and-access/features/membership.md): accounts are superuser-provisioned, so there is no
	// public /register page — only /login.
	{ path: "/login", element: <LoginPage />, errorElement: <ErrorPage /> },

	// Every signed-in route sits in the shell. The graph-less pages are the
	// shell's own; each product adds its routes from its definition.
	{
		path: "/",
		element: (
			<ProtectedRoute>
				<ExplorerSlotsContext.Provider value={explorerSlots}>
					<ModellerSlotsContext.Provider value={modellerSlots}>
						<AgentsSlotsContext.Provider value={agentsSlots}>
							<StudioShell products={products} />
						</AgentsSlotsContext.Provider>
					</ModellerSlotsContext.Provider>
				</ExplorerSlotsContext.Provider>
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

			...productRoutes(products),

			{ path: "*", element: <ErrorPage /> },
		],
	},
]);
