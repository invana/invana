import type {
	ProductDefinition,
	ProductIcon,
	SearchHit,
} from "@invana-studio/core";
import {
	formatRelativeTime,
	requestAsk,
	useGraphsQuery,
} from "@invana-studio/core";
import { useQueries, useQuery } from "@tanstack/react-query";
import { FolderGit2, History, Sparkles } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { activityPath } from "../activity/activityPath";
import { runTitle } from "../activity/inbox/inbox";
import { recentRunsQuery } from "../activity/inbox/useInbox";
import {
	joinPath,
	productBase,
	useActiveProduct,
	useOpenGraph,
	useProducts,
} from "../products";
import { rankByName } from "./rank";

/** One row in ⌘K. */
interface PaletteEntry {
	key: string;
	label: string;
	/** What it is, right-aligned. */
	detail?: string;
	keywords?: string[];
	icon?: ProductIcon;
	run: () => void;
}

interface PaletteGroup {
	heading: string;
	entries: PaletteEntry[];
}

/** How many rows a group shows for a query — few, so *Ask the assistant* stays in view. */
const PER_GROUP = 4;

/**
 * What ⌘K shows for `query`, grouped: one group per product (its records,
 * its rail's sections and its `commands`), then the Graph's runs as
 * *Activity*, the Graphs you can open, anything matched on meaning as
 * *Related*, and last *Ask the assistant*.
 *
 * Each product's records are read once per opening (`open`), through its
 * definition's `search`, and matched here as the person types — no request
 * per keystroke. With nothing typed it lists the open product's entries, or
 * the Graphs when no product is open.
 */
export function usePaletteGroups(query: string, open: boolean) {
	const products = useProducts();
	const active = useActiveProduct();
	const graph = useOpenGraph();
	const navigate = useNavigate();
	const { pathname, search } = useLocation();
	const q = query.trim();

	const searchable = products.filter(
		(p) => p.scope === "graph" && p.search && graph,
	);
	const results = useQueries({
		queries: searchable.map((p) => ({
			queryKey: ["search", p.id, graph?.username, graph?.graphSlug] as const,
			queryFn: () =>
				graph && p.search ? p.search(graph) : Promise.resolve([]),
			enabled: open,
			staleTime: 30_000,
		})),
	});
	const runs = useQuery({
		...recentRunsQuery(graph),
		enabled: open && !!graph,
	});
	const graphs = useGraphsQuery();

	const hitsOf = (p: ProductDefinition): SearchHit[] => {
		const i = searchable.indexOf(p);
		return i >= 0 ? (results[i]?.data ?? []) : [];
	};

	const groups: PaletteGroup[] = [];
	const related: PaletteEntry[] = [];

	for (const product of products) {
		const base = productBase(product, graph);
		if (!base) continue;
		const go = (to: string) => () => navigate(joinPath(base, to));
		const sections: PaletteEntry[] = product.nav
			? [...product.nav.groups.flat(), ...product.nav.bottom].map((item) => ({
					key: `${product.id}:nav:${item.id}`,
					label: item.label,
					detail: "section",
					icon: item.icon,
					run: go(item.to),
				}))
			: [];
		const commands: PaletteEntry[] = (product.commands ?? []).map((c) => ({
			key: `${product.id}:cmd:${c.id}`,
			label: c.label,
			keywords: c.keywords,
			icon: c.icon ?? product.icon,
			run: go(c.to),
		}));
		const hits = hitsOf(product);
		const records: PaletteEntry[] = hits
			.filter((h) => h.match !== "related")
			.map((h) => ({
				key: `${product.id}:hit:${h.id}`,
				label: h.label,
				detail: h.detail,
				icon: h.icon ?? product.icon,
				run: go(h.to),
			}));
		for (const h of hits.filter((h) => h.match === "related")) {
			related.push({
				key: `${product.id}:related:${h.id}`,
				label: h.label,
				detail: h.detail ?? "related by meaning",
				icon: h.icon ?? product.icon,
				run: go(h.to),
			});
		}

		const entries = q
			? rankByName(q, [...records, ...sections, ...commands], PER_GROUP)
			: product === active
				? [...commands, ...sections]
				: [];
		if (entries.length) groups.push({ heading: product.name, entries });
	}

	if (graph && q) {
		const runEntries: PaletteEntry[] = (runs.data?.items ?? []).map((r) => {
			const at = r.finished_at ?? r.started_at ?? r.queued_at;
			return {
				key: `activity:run:${r.id}`,
				label: runTitle(r),
				detail: [
					"run",
					r.status.replace("_", " "),
					at && formatRelativeTime(new Date(at)),
				]
					.filter(Boolean)
					.join(" · "),
				icon: History,
				run: () => navigate(activityPath(graph, "runs", r.id)),
			};
		});
		const ranked = rankByName(q, runEntries, PER_GROUP);
		if (ranked.length) groups.push({ heading: "Activity", entries: ranked });
	}

	const graphEntries: PaletteEntry[] = (graphs.data?.items ?? [])
		.filter((g) => g.status === "active")
		.map((g) => ({
			key: `graph:${g.id}`,
			label: g.name,
			keywords: [g.slug],
			detail: `Graph · ${g.owner_username}`,
			icon: FolderGit2,
			run: () => navigate(`/u/${g.owner_username}/${g.slug}`),
		}));
	const shownGraphs = q
		? rankByName(q, graphEntries, PER_GROUP)
		: active
			? []
			: graphEntries.slice(0, PER_GROUP);
	if (shownGraphs.length)
		groups.push({ heading: "Graphs", entries: shownGraphs });

	if (q && related.length)
		groups.push({ heading: "Related", entries: related.slice(0, PER_GROUP) });

	if (q && graph) {
		groups.push({
			heading: "Do",
			entries: [
				{
					key: "do:ask",
					label: `Ask the assistant: “${q}”`,
					icon: Sparkles,
					run: () => {
						requestAsk(q);
						// A graph product docks the chat where the person is; anywhere
						// else on the Graph (Activity) the ask goes to Explorer.
						if (active?.scope === "graph") {
							const params = new URLSearchParams(search);
							params.set("right", "assistant");
							navigate(`${pathname}?${params}`);
						} else {
							navigate(
								`/u/${graph.username}/${graph.graphSlug}/explorer?right=assistant`,
							);
						}
					},
				},
			],
		});
	}

	const failed = searchable
		.filter((_, i) => results[i]?.isError)
		.map((p) => p.name);
	if (runs.isError) failed.push("Activity");
	const searching =
		results.some((r) => r.isFetching) || runs.isFetching || graphs.isFetching;

	return { groups, failed, searching };
}
