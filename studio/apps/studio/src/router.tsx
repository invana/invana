import { AgentsSlotsContext, useAgentsQuery } from "@invana-studio/agents";
import { ExplorerSlotsContext } from "@invana-studio/explorer";
import { ModellerSlotsContext } from "@invana-studio/modeller";
import { ProjectsSlotsContext } from "@invana-studio/projects";
import {
	ActivitySlotsContext,
	ErrorPage,
	GraphCreatePage,
	GraphsListPage,
	graphRoutes,
	LoginPage,
	PlatformEventsPage,
	ProfileSettingsPage,
	ProtectedRoute,
	productRoutes,
	StudioShell,
} from "@invana-studio/shell";
import { createBrowserRouter, Navigate } from "react-router-dom";
import { activitySlots } from "@/host/activitySlots";
import { ProductHostRoute } from "@/host/ProductHostRoute";
import { products } from "@/products";
import { modellerSlots } from "@/products/modellerSlots";

// The Explorer's, the Modeller's, the Projects and the Agents product's routes
// draw the product host, which composes all four. Projects reads the agents a
// Todo can be handed to from the Agents product, through its slot.
const explorerSlots = { Page: ProductHostRoute };
const agentsSlots = { Page: ProductHostRoute };
const projectsSlots = { Page: ProductHostRoute, useAgents: useAgentsQuery };

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
							<ProjectsSlotsContext.Provider value={projectsSlots}>
								{/* Activity is the shell's route, and a run's page in it
								    names agents and govern records the shell may not import. */}
								<ActivitySlotsContext.Provider value={activitySlots}>
									<StudioShell products={products} />
								</ActivitySlotsContext.Provider>
							</ProjectsSlotsContext.Provider>
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

			...graphRoutes,
			...productRoutes(products),

			{ path: "*", element: <ErrorPage /> },
		],
	},
]);
