import { Navigate, createBrowserRouter } from "react-router-dom";
import App from "./App";
import { ErrorPage } from "./pages/ErrorPage";
import { GraphCreatePage } from "./pages/graphs/GraphCreatePage";
import { GraphEditPage } from "./pages/graphs/GraphEditPage";
import { GraphsListPage } from "./pages/graphs/GraphsListPage";
import { ExplorerPage } from "./pages/graphs/explorer/ExplorerPage";
import { ModellerPage } from "./pages/graphs/modeller/ModellerPage";

export const router = createBrowserRouter([
	// Full-page layouts — own AppLayoutV2, not nested under App shell
	{
		path: "graphs/:id/modeller",
		element: <ModellerPage />,
		errorElement: <ErrorPage />,
	},
	{
		path: "graphs/:id/explorer",
		element: <ExplorerPage />,
		errorElement: <ErrorPage />,
	},

	// App shell layout
	{
		path: "/",
		element: <App />,
		errorElement: <ErrorPage />,
		children: [
			{ index: true, element: <Navigate to="/graphs" replace /> },
			{ path: "graphs", element: <GraphsListPage /> },
			{ path: "graphs/new", element: <GraphCreatePage /> },
			{ path: "graphs/:id/edit", element: <GraphEditPage /> },
			{ path: "*", element: <ErrorPage /> },
		],
	},
]);
