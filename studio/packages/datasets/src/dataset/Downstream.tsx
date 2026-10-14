/**
 * What cites a dataset — the Graphs that bound it and the datasets derived
 * from it — as one list of rows that open where each one lives, whichever
 * versions are asked for. Each row names the version it cites.
 *
 * Read from the engine's `used`, which lists bindings only in Graphs the
 * reader belongs to; a Graph the reader cannot open is never named. A binding
 * on an older version than the dataset's newest says so (`v2 · behind`); a
 * row citing a retracted version is flagged.
 */

import {
	Badge,
	Button,
	Item,
	ItemActions,
	ItemContent,
	ItemDescription,
	ItemGroup,
	ItemTitle,
	Spinner,
} from "@invana/ui";
import { useGraphsQuery } from "@invana-studio/core";
import { activityPath } from "@invana-studio/shell";
import { useNavigate } from "react-router-dom";
import { parseAddress } from "../api";
import { useUsageQuery } from "../queries";
import { datasetPath, useDatasetOutlet } from "./context";

export function Downstream({
	address,
	versions,
}: {
	address: string;
	versions: number[];
}) {
	const { ref } = useDatasetOutlet();
	const navigate = useNavigate();
	const used = useUsageQuery(ref, versions);
	const graphs = useGraphsQuery();

	if (used.isLoading) return <Spinner />;
	const bindings = used.items.flatMap(({ usage }) =>
		usage.bindings.map((b) => ({ b, flagged: usage.retracted !== null })),
	);
	const derived = used.items.flatMap(({ version, usage }) =>
		usage.derived.map((d) => ({
			d,
			version,
			flagged: usage.retracted !== null,
		})),
	);
	if (!bindings.length && !derived.length) {
		return (
			<p className="text-sm text-muted-foreground">
				Nothing you can open cites {address} — no Graph of yours binds it and no
				dataset derives from it.
			</p>
		);
	}

	return (
		<ItemGroup>
			{bindings.map(({ b, flagged }) => {
				const graph = graphs.data?.items.find((g) => g.id === b.graph_id);
				const ref = graph
					? { username: graph.owner_username, graphSlug: graph.slug }
					: null;
				return (
					<Item key={b.id} variant="outline">
						<ItemContent>
							<ItemTitle>{graph?.name ?? "A Graph"}</ItemTitle>
							<ItemDescription>
								Graph · bound to model {b.model_name ?? "—"} · type{" "}
								{b.type_name}
							</ItemDescription>
						</ItemContent>
						<ItemActions>
							{flagged ? (
								<Badge variant="soft" tone="warning" size="xs">
									v{b.version} · flagged
								</Badge>
							) : b.newer_version ? (
								<Badge variant="outline" tone="muted" size="xs">
									v{b.version} · behind
								</Badge>
							) : (
								<Badge variant="outline" tone="muted" size="xs">
									v{b.version}
								</Badge>
							)}
							{ref && b.run_id ? (
								<Button
									variant="outline"
									size="sm"
									onClick={() =>
										navigate(activityPath(ref, "runs", b.run_id as string))
									}
								>
									Open
								</Button>
							) : null}
						</ItemActions>
					</Item>
				);
			})}
			{derived.map(({ d, version, flagged }) => {
				const parts = parseAddress(d.address);
				return (
					<Item key={d.version_id} variant="outline">
						<ItemContent>
							<ItemTitle>{d.address}</ItemTitle>
							<ItemDescription>derived dataset</ItemDescription>
						</ItemContent>
						<ItemActions>
							<Badge
								variant={flagged ? "soft" : "outline"}
								tone={flagged ? "warning" : "muted"}
								size="xs"
							>
								reads v{version}
								{flagged ? " · flagged" : ""}
							</Badge>
							<Button
								variant="outline"
								size="sm"
								onClick={() => navigate(datasetPath(parts))}
							>
								Open
							</Button>
						</ItemActions>
					</Item>
				);
			})}
		</ItemGroup>
	);
}
