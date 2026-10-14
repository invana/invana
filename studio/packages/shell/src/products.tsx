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
import { type QueryKey, useQueryClient } from "@tanstack/react-query";
import {
	createContext,
	type ReactNode,
	useContext,
	useSyncExternalStore,
} from "react";
import { type Params, type RouteObject, useMatches } from "react-router-dom";

/** What a route's `handle` may carry for the shell. */
export interface ShellRouteHandle {
	/** Stamped by `productRoutes` — the product this route belongs to. */
	product?: ProductId;
	/** The route draws every region itself; the shell adds no layout around it. */
	ownsRegions?: boolean;
	/** This route's level in the breadcrumbs: a label, or one read off the params. */
	crumb?: string | ((params: Params) => string | undefined);
	/** The crumb's hover text when its label is shortened — a run's full id. */
	crumbTitle?: (params: Params) => string | undefined;
	/**
	 * A label read from a query the page runs itself — a record's name once
	 * its read lands. Until then, and when it fails, `crumb` stands in.
	 */
	crumbFrom?: (params: Params) => CrumbSource | undefined;
}

interface CrumbSource {
	queryKey: QueryKey;
	label: (data: unknown) => string | undefined;
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
 *
 * The deepest route with a `crumbFrom` is labelled from the query cache: the
 * trail only reads what its page already fetched, and re-renders when that
 * read lands. It never fetches, so it adds no request and no second observer.
 */
export function useRouteCrumbs(): {
	label: string;
	to: string;
	title?: string;
}[] {
	const matches = useMatches();
	const client = useQueryClient();
	const named = [...matches].reverse().find((m) => handleOf(m).crumbFrom);
	const source = named ? handleOf(named).crumbFrom?.(named.params) : undefined;
	const data = useSyncExternalStore(
		(onChange) => client.getQueryCache().subscribe(onChange),
		() => (source ? client.getQueryData(source.queryKey) : undefined),
	);
	const read = source && data !== undefined ? source.label(data) : undefined;

	return matches.flatMap((m) => {
		const { crumb, crumbTitle } = handleOf(m);
		if (m === named && read) return [{ label: read, to: m.pathname }];
		const label = typeof crumb === "function" ? crumb(m.params) : crumb;
		if (!label) return [];
		const title = crumbTitle?.(m.params);
		return [{ label, to: m.pathname, ...(title ? { title } : {}) }];
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
 * an install product under its own id.
 */
export function productBase(
	product: ProductDefinition,
	graph: { username: string; graphSlug: string } | undefined,
): string | undefined {
	if (product.scope === "install") return `/${product.id}`;
	if (!graph) return undefined;
	return `/u/${graph.username}/${graph.graphSlug}/${product.id}`;
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
