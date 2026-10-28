/**
 * The union, beside the drawing — every type the published models hold, with
 * the models contributing it, the anchored stitches, and the edge types
 * (stitch-models.md the-model-page.md Model tab).
 *
 * It is stated rather than drawn: a global type carries no endpoints, so the
 * drawing is the canvas next to it, and this is the list a person reads to
 * answer "who else holds this?". Derived on read; there is no row behind it.
 * An anchored row opens that stitch in the inspector.
 */

import { Badge, SectionHeader, Spinner } from "@invana/ui";
import { OutlineRow } from "../model-editor/components/OutlineRow";
import { useGlobalModelQuery, useModelLinksQuery } from "../queries";
import type { GlobalType } from "../types";
import { stitchPair } from "./allModels";

function Rows({ types }: { types: GlobalType[] }) {
	return (
		<div className="flex flex-col">
			{types.map((t) => (
				<div
					key={t.name}
					className="flex items-baseline gap-2 border-t border-border/60 px-3 py-1"
				>
					<span className="min-w-0 shrink-0 font-mono text-sm">{t.name}</span>
					{/* Anchored means one entity across models rather than a coincidence
					    of naming — the difference between a union and a collision. */}
					{t.anchored ? (
						<Badge variant="soft" tone="info" size="xs">
							anchored
						</Badge>
					) : null}
					<span className="ml-auto min-w-0 truncate text-sm text-muted-foreground">
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
	onOpenStitch,
}: {
	username: string;
	graphSlug: string;
	/** An anchored row was picked — inspect that stitch. */
	onOpenStitch: (linkId: string) => void;
}) {
	const union = useGlobalModelQuery(username, graphSlug);
	const links = useModelLinksQuery(username, graphSlug);
	const derived = union.data;
	if (!derived) {
		return (
			<div className="p-3">
				<Spinner />
			</div>
		);
	}
	const anchors = (links.data ?? []).filter(
		(l) => l.kind === "anchor" && l.status === "active",
	);
	return (
		<div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
			<SectionHeader
				title="Global model"
				count={`${derived.node_types.length} node · ${derived.edge_types.length} edge`}
			/>
			<SectionHeader
				bare
				title="Node types"
				count={derived.node_types.length}
			/>
			<Rows types={derived.node_types} />
			{anchors.length > 0 ? (
				<>
					<SectionHeader bare title="Anchored" count={anchors.length} />
					{anchors.map((l) => (
						<OutlineRow
							key={l.id}
							onClick={() => onOpenStitch(l.id)}
							tone="info"
							name={stitchPair(l, false)}
							meta={`${l.source_model ?? "?"} · ${l.target_model ?? "?"}`}
						/>
					))}
				</>
			) : null}
			<SectionHeader
				bare
				title="Edge types"
				count={derived.edge_types.length}
			/>
			<Rows types={derived.edge_types} />
			{derived.staged_count > 0 ? (
				<p className="px-3 py-1.5 text-sm text-warning">
					{derived.staged_count} staged — not in the union until committed
				</p>
			) : null}
		</div>
	);
}
