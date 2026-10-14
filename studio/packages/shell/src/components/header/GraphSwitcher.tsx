import {
	Button,
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@invana/ui";
import { useGraphQuery, useGraphsQuery } from "@invana-studio/core";
import { ChevronDown } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { productBase, useActiveProduct, useOpenGraph } from "../../products";

/**
 * The header's first level inside a Graph: the open Graph's name, opening a
 * menu of every Graph the person can reach. Switching keeps the open product,
 * so the Explorer on one Graph lands on the Explorer of the next. The owner
 * is not a level of its own — it is in the URL and in the menu, not in the
 * header.
 */
export function GraphSwitcher() {
	const graph = useOpenGraph();
	const product = useActiveProduct();
	const navigate = useNavigate();
	const { data: open } = useGraphQuery(graph?.username, graph?.graphSlug);
	const { data: graphs } = useGraphsQuery();
	if (!graph) return null;

	const go = (username: string, graphSlug: string) => {
		const target = { username, graphSlug };
		navigate(
			(product && productBase(product, target)) ??
				`/u/${username}/${graphSlug}`,
		);
	};

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button
					variant="ghost"
					size="sm"
					className="gap-1 px-1.5 font-medium"
					aria-label="Switch graph"
					title={`${graph.username}/${graph.graphSlug}`}
				>
					{open?.name ?? graph.graphSlug}
					<ChevronDown className="text-muted-foreground" />
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent side="bottom" align="start" className="w-64">
				<DropdownMenuLabel>Graphs</DropdownMenuLabel>
				{(graphs?.items ?? []).map((g) => (
					<DropdownMenuItem
						key={g.id}
						onSelect={() => go(g.owner_username, g.slug)}
					>
						<span className="flex-1 truncate">{g.name}</span>
						<span className="text-xs text-muted-foreground">
							{g.owner_username}
						</span>
					</DropdownMenuItem>
				))}
				<DropdownMenuSeparator />
				<DropdownMenuItem onSelect={() => navigate("/graphs")}>
					All graphs
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
