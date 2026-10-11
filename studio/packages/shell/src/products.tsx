/**
 * The product registry — the list the app hands `<StudioShell>`, and what the
 * shell reads off it: which product is open, where each one lands, and the
 * routes they add.
 *
 * The open product is the route's, not a piece of state: `productRoutes`
 * stamps each product's top-level routes with `handle.product`, and
 * `useActiveProduct` reads the deepest match that carries one. A graph-less
 * page (the Graphs list, profile) matches none, so no product is open there.
 */
import type { ProductDefinition, ProductId } from "@invana-studio/core";
import { createContext, type ReactNode, useContext } from "react";
import { type Params, type RouteObject, useMatches } from "react-router-dom";

/** What a route's `handle` may carry for the shell. */
export interface ShellRouteHandle {
	/** Stamped by `productRoutes` — the product this route belongs to. */
	product?: ProductId;
	/** The route draws every region itself; the shell adds no layout around it. */
	ownsRegions?: boolean;
	/** This route's level in the breadcrumbs: a label, or one read off the params. */
	crumb?: string | ((params: Params) => string | undefined);
}

const ProductsContext = createContext<ProductDefinition[]>([]);

export function ProductsProvider({
	products,
	children,
}: {
	products: ProductDefinition[];
	children: ReactNode;
}) {
	return (
		<ProductsContext.Provider value={products}>
			{children}
		</ProductsContext.Provider>
	);
}

/** Every registered product, in launcher order. */
export function useProducts(): ProductDefinition[] {
	return useContext(ProductsContext);
}

function handleOf(match: { handle: unknown }): ShellRouteHandle {
	return (match.handle ?? {}) as ShellRouteHandle;
}

/** The product whose route is open, or `undefined` on a graph-less page. */
export function useActiveProduct(): ProductDefinition | undefined {
	const products = useProducts();
	const id = useMatches()
		.map((m) => handleOf(m).product)
		.filter(Boolean)
		.at(-1);
	return products.find((p) => p.id === id);
}

/**
 * The open route's levels, outermost first — one per matched route whose
 * handle names a `crumb`, each linking to the path that route matched. A
 * tab is a query param, never a route, so switching tabs keeps the trail.
 */
export function useRouteCrumbs(): { label: string; to: string }[] {
	return useMatches().flatMap((m) => {
		const { crumb } = handleOf(m);
		const label = typeof crumb === "function" ? crumb(m.params) : crumb;
		return label ? [{ label, to: m.pathname }] : [];
	});
}

/** Whether the open route draws its own regions. */
export function useRouteOwnsRegions(): boolean {
	return useMatches().some((m) => handleOf(m).ownsRegions);
}

/** The Graph the open route is in — `/u/:username/:graphSlug/…` — if any. */
export function useOpenGraph():
	| { username: string; graphSlug: string }
	| undefined {
	const params = useMatches().at(-1)?.params ?? {};
	const { username, graphSlug } = params;
	return username && graphSlug ? { username, graphSlug } : undefined;
}

/**
 * Where a product's routes start. A graph product lives under the open Graph;
 * an install product under its own id. `legacy-graph` is today's graph page,
 * so its base is the Graph's own URL.
 */
export function productBase(
	product: ProductDefinition,
	graph: { username: string; graphSlug: string } | undefined,
): string | undefined {
	if (product.scope === "install") return `/${product.id}`;
	if (!graph) return undefined;
	const root = `/u/${graph.username}/${graph.graphSlug}`;
	return product.id === "legacy-graph" ? root : `${root}/${product.id}`;
}

/** Joins a base and a relative path without doubling or dropping a slash. */
export function joinPath(base: string, to: string): string {
	const tail = to.replace(/^\/+/, "");
	return tail ? `${base.replace(/\/+$/, "")}/${tail}` : base;
}

/**
 * Every product's routes, each top-level route stamped with its product so
 * the shell can tell which one is open. The app mounts the result under
 * `<StudioShell>`.
 */
export function productRoutes(products: ProductDefinition[]): RouteObject[] {
	return products.flatMap((product) =>
		product.routes.map(
			(route) =>
				({
					...route,
					handle: { ...(route.handle ?? {}), product: product.id },
				}) as RouteObject,
		),
	);
}
