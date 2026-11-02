import {
	Button,
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@invana/ui";
import {
	type ProductDefinition,
	type ProductIcon,
	type ProductScope,
	useAuth,
} from "@invana-studio/core";
import { ExperimentalBadge } from "@invana-studio/ui";
import { Check, Grip, House } from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
	joinPath,
	productBase,
	useActiveProduct,
	useOpenGraph,
	useProducts,
} from "../../products";

/** Home is the shell's own page, not a product: the Graphs list. */
const HOME = {
	id: "home",
	name: "Home",
	tagline: "Your decisions across every Graph",
	icon: House as ProductIcon,
	to: "/graphs",
};

interface Row {
	id: string;
	name: string;
	tagline: string;
	experimental?: boolean;
	icon: ProductIcon;
	to: string;
	current: boolean;
}

/** The launcher group a product is listed in. */
const groupOf = (p: ProductDefinition): ProductScope => p.group ?? p.scope;

/**
 * The 9-dot launcher at the far left of the header, in two groups:
 *
 * - **Invana** — Home, then every platform product, in the order the app
 *   lists them. They open off any Graph, so opening one from a Graph drops
 *   the Graph picker.
 * - **This Graph · name** — every graph product, only while a Graph is open;
 *   each lands under it.
 *
 * A product whose `audience` is `builders` is listed only for an install
 * Admin. A product listed with the platform whose routes are still a Graph's
 * opens in the open Graph, or the Graphs list when none is. The open product
 * is ticked.
 */
export function Launcher() {
	const products = useProducts();
	const active = useActiveProduct();
	const graph = useOpenGraph();
	const { isSuperuser } = useAuth();
	const navigate = useNavigate();

	const listed = products.filter(
		(p) => p.audience !== "builders" || isSuperuser,
	);
	const row = (product: ProductDefinition): Row => {
		const base = productBase(product, graph);
		return {
			id: product.id,
			name: product.name,
			tagline: product.tagline,
			experimental: product.experimental,
			icon: product.icon,
			to: base ? joinPath(base, product.landing) : "/graphs",
			current: product.id === active?.id,
		};
	};
	const platform: Row[] = [
		{ ...HOME, current: false },
		...listed.filter((p) => groupOf(p) === "platform").map(row),
	];
	const inGraph = graph
		? listed.filter((p) => groupOf(p) === "graph").map(row)
		: [];

	const item = (r: Row) => {
		const Icon = r.icon;
		return (
			<DropdownMenuItem
				key={r.id}
				aria-current={r.current ? "page" : undefined}
				onSelect={() => navigate(r.to)}
			>
				<Icon className="size-4 text-primary" />
				<span className="flex min-w-0 flex-1 flex-col">
					<span className="flex items-center gap-2">
						{r.name}
						{r.experimental && <ExperimentalBadge />}
					</span>
					<span className="text-xs text-muted-foreground">{r.tagline}</span>
				</span>
				{r.current && <Check className="size-4 text-primary" />}
			</DropdownMenuItem>
		);
	};

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button
					variant="ghost"
					size="icon"
					aria-label="Products"
					title="Products"
				>
					<Grip className="size-4" />
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent side="bottom" align="start" className="w-96">
				<DropdownMenuGroup aria-label="Invana">
					<DropdownMenuLabel className="text-xs uppercase text-muted-foreground">
						Invana
					</DropdownMenuLabel>
					{platform.map(item)}
				</DropdownMenuGroup>
				{graph && inGraph.length > 0 && (
					<>
						<DropdownMenuSeparator />
						<DropdownMenuGroup aria-label="This Graph">
							<DropdownMenuLabel className="text-xs uppercase text-muted-foreground">
								This Graph · {graph.graphSlug}
							</DropdownMenuLabel>
							{inGraph.map(item)}
						</DropdownMenuGroup>
					</>
				)}
				<DropdownMenuSeparator />
				<DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
					{graph
						? "A platform product leaves the Graph · its picker goes"
						: "Open a Graph to see its products"}
				</DropdownMenuLabel>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
