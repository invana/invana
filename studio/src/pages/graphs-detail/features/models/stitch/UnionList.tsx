/**
 * The union, beside the drawing — every type the published models hold, with
 * the models contributing it (stitch-models.md ST6 · the-model-page.md Model tab).
 *
 * It is stated rather than drawn: a global type carries no endpoints, so the
 * drawing is the canvas next to it, and this is the list a person reads to
 * answer "who else holds this?". Derived on read; there is no row behind it.
 */

import { Badge, PanelBox, SectionHeader, Spinner } from "@invana/ui";
import { useGlobalModelQuery } from "@/pages/graphs-detail/features/models/queries";
import type { GlobalType } from "@/pages/graphs-detail/features/models/types";

function Rows({ types }: { types: GlobalType[] }) {
	return (
		<div className="flex flex-col">
			{types.map((t) => (
				<div
					key={t.name}
					className="flex items-baseline gap-2 border-t border-border/60 px-3 py-1"
				>
					<span className="truncate font-mono text-sm">{t.name}</span>
					{/* Anchored means one entity across models rather than a coincidence
					    of naming — the difference between a union and a collision. */}
					{t.anchored ? (
						<Badge variant="soft" tone="info" size="xs">
							anchored
						</Badge>
					) : null}
					<span className="ml-auto shrink-0 truncate text-sm text-muted-foreground">
						{t.models.join(" · ")}
					</span>
				</div>
			))}
		</div>
	);
}

export function UnionList({
	username,
	graphSlug,
}: {
	username: string;
	graphSlug: string;
}) {
	const union = useGlobalModelQuery(username, graphSlug);
	const derived = union.data;
	return (
		<PanelBox
			title="The union"
			aside={
				derived
					? `${derived.node_types.length} node · ${derived.edge_types.length} edge`
					: undefined
			}
			flush
			className="flex min-h-0 w-68 shrink-0 flex-col"
			bodyClassName="min-h-0 overflow-y-auto"
		>
			{!derived ? (
				<div className="p-3">
					<Spinner />
				</div>
			) : (
				<>
					<SectionHeader
						title="Node types"
						count={derived.node_types.length}
						bare
					/>
					<Rows types={derived.node_types} />
					<SectionHeader
						title="Edge types"
						count={derived.edge_types.length}
						bare
					/>
					<Rows types={derived.edge_types} />
					{derived.staged_count > 0 ? (
						<p className="px-3 py-1.5 text-sm text-warning">
							{derived.staged_count} staged — not in the union until committed
						</p>
					) : null}
				</>
			)}
		</PanelBox>
	);
}
