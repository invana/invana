/**
 * `<StudioShell>` — the one `AppLayoutV2` composition every screen sits in.
 *
 * The app mounts it as the root of every signed-in route and hands it the
 * product list; it never imports a product. It provides the registry
 * (`useProducts`, `useActiveProduct`, `useAction`) and draws:
 *
 * - `header` — launcher, `Invana <Product>`, Graph picker, breadcrumbs, ⌘K,
 *   notifications, Assistant toggle and user menu (`useAppHeader`);
 * - `leftNav` — the open product's `nav`, one icon lit; none on a graph-less
 *   page or for a product whose `nav` is `null`;
 * - `mainSection` — the route's page, behind an error boundary that starts
 *   afresh on every navigation.
 *
 * A route whose handle says `ownsRegions` draws every region itself through
 * `<StudioShellLayout>` (today's graph page, which fills `leftSection`,
 * `rightSection` and `footer` from its own URL state); the shell then
 * provides the registry and adds no layout of its own.
 */
import { AppLayoutV2 } from "@invana/themes";
import { ErrorBoundary } from "@invana/ui";
import type {
	NavItem,
	ProductDefinition,
	ProductIcon,
} from "@invana-studio/core";
import { reportBoundaryError } from "@invana-studio/core";
import type { ComponentProps } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { ActionDialogHost } from "./actions";
import {
	type AppHeaderOptions,
	useAppHeader,
} from "./components/header/useAppHeader";
import {
	joinPath,
	ProductsProvider,
	productBase,
	useActiveProduct,
	useOpenGraph,
	useRouteOwnsRegions,
} from "./products";

type LayoutProps = ComponentProps<typeof AppLayoutV2>;
type NavVerticalProps = NonNullable<LayoutProps["leftNav"]>;

/**
 * The class for one `leftNav` icon. The theme's NavVertical keeps its own
 * "last clicked" highlight per group, so two icons can look lit at once; the
 * shell drives the highlight from the URL instead, forcing it with `!`, and
 * re-asserts hover on the inactive ones so the override keeps hover feedback.
 * `my-1.5` adds the breathing room the theme's `gap-1` lacks.
 */
export function leftNavItemClassName(active: boolean): string {
	return active
		? "my-1.5 !bg-primary/15 !text-primary !ring-primary/25"
		: "my-1.5 !bg-transparent !text-foreground !ring-transparent hover:!bg-primary/10 hover:!text-primary hover:!ring-primary/25";
}

/**
 * The params a rail move carries: the regions that outlive `leftSection` — the
 * docked chat (`right`), the Console (`console`) and the Workbook's focused
 * page (`page`). Everything else in the query string belongs to the panel being
 * left, so it is dropped.
 */
const REGION_PARAMS = ["right", "console", "page"] as const;

/** `search` reduced to the region params, as a `?…` suffix or `""`. */
function regionSearch(search: string): string {
	const from = new URLSearchParams(search);
	const kept = new URLSearchParams();
	for (const key of REGION_PARAMS) {
		const value = from.get(key);
		if (value !== null) kept.set(key, value);
	}
	const query = kept.toString();
	return query ? `?${query}` : "";
}

/** The open product's `nav` as the theme's `leftNav`, or none. */
function useProductLeftNav(
	product: ProductDefinition | undefined,
): NavVerticalProps | undefined {
	const graph = useOpenGraph();
	const { pathname, search } = useLocation();
	const navigate = useNavigate();
	const base = product && productBase(product, graph);
	if (!product?.nav || !base) return undefined;
	const { groups, bottom } = product.nav;
	const carried = regionSearch(search);

	// A separator closes every group but the last.
	const toItem = (item: NavItem, showSeperator = false) => {
		const target = joinPath(base, item.to);
		const active = pathname === target || pathname.startsWith(`${target}/`);
		return {
			name: item.label,
			icon: item.icon as ProductIcon,
			iconClassName: "w-5 h-5",
			tooltipSide: "right" as const,
			className: leftNavItemClassName(active),
			showSeperator,
			onClick: () => navigate(`${target}${carried}`),
		};
	};
	return {
		topNavItems: groups.flatMap((group, g) =>
			group.map((item, i) =>
				toItem(item, i === group.length - 1 && g < groups.length - 1),
			),
		),
		bottomNavItems: bottom.map((item) => toItem(item)),
	} as NavVerticalProps;
}

export interface StudioShellLayoutProps
	extends Omit<LayoutProps, "header" | "leftNav"> {
	/** What fills the header's slots and breadcrumb. */
	header?: AppHeaderOptions;
	/** Replaces the open product's `nav` — for a route that drives its own `leftNav`. */
	leftNav?: NavVerticalProps;
}

/** The shell's regions, for a route that fills them itself. */
export function StudioShellLayout({
	header,
	leftNav,
	...regions
}: StudioShellLayoutProps) {
	const product = useActiveProduct();
	const productNav = useProductLeftNav(product);
	return (
		<AppLayoutV2
			{...regions}
			header={useAppHeader(header)}
			leftNav={leftNav ?? productNav}
		/>
	);
}

function ShellPage() {
	// A page that throws shows the kit's notice in the main region and is
	// reported; navigating to another page starts it afresh.
	const { pathname } = useLocation();
	return (
		<StudioShellLayout
			mainSection={{
				content: (
					<ErrorBoundary key={pathname} onError={reportBoundaryError}>
						<Outlet />
					</ErrorBoundary>
				),
			}}
		/>
	);
}

export function StudioShell({ products }: { products: ProductDefinition[] }) {
	return (
		<ProductsProvider products={products}>
			<ActionDialogHost>
				<ShellOutlet />
			</ActionDialogHost>
		</ProductsProvider>
	);
}

function ShellOutlet() {
	return useRouteOwnsRegions() ? <Outlet /> : <ShellPage />;
}
