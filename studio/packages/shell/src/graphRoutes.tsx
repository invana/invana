/**
 * The route on a Graph that no product owns: the Graph's own URL. The app
 * mounts it under `<StudioShell>` beside the products' routes
 * (migration-plan §5). `/u/:user/:graph` opens the product this browser last
 * had open on a Graph, else Explorer, carrying the query string across — so
 * `?right=`, `?page=` and `?onboarding=` land in the product.
 *
 * Every route on a Graph first sends an old link — `?panel=`, `?settings=`,
 * `?drawer=`, a product's bare root — to its path (`<CanonicalRoute>`). The
 * redirect table is `regions/panelPaths`, and it stays for good: bookmarks
 * outlive the page they were made on.
 */
import type { ReactNode } from "react";
import { Navigate, type RouteObject, useLocation } from "react-router-dom";
import { lastProduct } from "./lastProduct";
import { ErrorPage } from "./pages/ErrorPage";
import { joinPath, productBase, useOpenGraph, useProducts } from "./products";
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
		],
	},
];
