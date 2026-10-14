import {
	Button,
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@invana/ui";
import { Grip } from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
	joinPath,
	productBase,
	useActiveProduct,
	useOpenGraph,
	useProducts,
} from "../../products";

/**
 * The 9-dot launcher at the far left of the header — every registered product,
 * in the order the app lists them. Switching keeps the open Graph: a graph
 * product lands under it. With no Graph open, a graph product has nowhere to
 * land yet, so its row goes to the Graphs list to pick one.
 */
export function Launcher() {
	const products = useProducts();
	const active = useActiveProduct();
	const graph = useOpenGraph();
	const navigate = useNavigate();

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button
					variant="ghost"
					size="icon"
					className="h-7 w-7"
					aria-label="Products"
					title="Products"
				>
					<Grip className="h-4 w-4" />
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent side="bottom" align="start" className="w-64">
				<DropdownMenuLabel>Products</DropdownMenuLabel>
				<DropdownMenuSeparator />
				{products.map((product) => {
					const base = productBase(product, graph);
					const Icon = product.icon;
					return (
						<DropdownMenuItem
							key={product.id}
							aria-current={product.id === active?.id ? "page" : undefined}
							onSelect={() =>
								navigate(base ? joinPath(base, product.landing) : "/graphs")
							}
						>
							<Icon className="w-4 h-4 mr-2" />
							<span className="flex flex-col">
								<span>{product.name}</span>
								<span className="text-xs text-muted-foreground">
									{product.tagline}
								</span>
							</span>
						</DropdownMenuItem>
					);
				})}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
