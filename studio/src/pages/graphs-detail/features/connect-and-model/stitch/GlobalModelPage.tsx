/**
 * The global model — the read-time union of every published model plus the links
 * between them (stitch-models.md ST3).
 *
 * It is a **page**, not a panel section. Two reasons, and the second is the one
 * that matters: it belongs to no single model, so no model's panel can own it;
 * and it is the only part of stitching a person comes back to, because
 * declaring a link is something you do once and reading the union is something
 * you check whenever a question is about to cross a boundary.
 *
 * **It is not drawn.** `GlobalType` carries `name`, `models` and `anchored` and
 * *no endpoints*, so an edge type in the union does not say what it connects —
 * there is no graph here to lay out. Drawing it needs `source`/`target` on the
 * engine's global-model payload; until that exists this states the union
 * plainly rather than inventing a shape for it (DS15).
 */

import { useGlobalModelQuery } from "@/hooks/queries/useModels";
import type { GlobalType } from "@/types/models";
import {
	Badge,
	EmptyState,
	MetricGrid,
	MetricTile,
	SectionHeader,
	Spinner,
} from "@invana/ui";
import { AlertTriangle, Boxes } from "lucide-react";

interface Props {
	username: string;
	graphSlug: string;
}

function TypeList({ types }: { types: GlobalType[] }) {
	return (
		<div className="flex flex-col">
			{types.map((t) => (
				<div
					key={t.name}
					className="flex items-baseline gap-2 px-3 py-1.5 hover:bg-accent/50"
				>
					<span className="truncate font-medium text-foreground">{t.name}</span>
					{/* Anchored means this name is one entity across models rather than
					    a coincidence of naming — the difference between a union and a
					    collision, so it is stated, never implied by the count. */}
					{t.anchored ? (
						<Badge variant="soft" tone="info" size="xs">
							anchored
						</Badge>
					) : null}
					<span className="ml-auto shrink-0 truncate text-meta text-muted-foreground">
						{t.models.join(" · ")}
					</span>
				</div>
			))}
		</div>
	);
}

export function GlobalModelPage({ username, graphSlug }: Props) {
	const globalModel = useGlobalModelQuery(username, graphSlug);

	// A failed request and a slow one are different things. The panel this
	// replaced rendered `isLoading || !derived` as one spinner, so an error span
	// forever with nothing to act on.
	if (globalModel.isError) {
		return (
			<div className="flex h-full w-full items-center justify-center p-6">
				<EmptyState
					icon={<AlertTriangle />}
					title="The global model could not be derived"
					description={
						globalModel.error instanceof Error
							? globalModel.error.message
							: "The engine did not answer for this graph."
					}
				/>
			</div>
		);
	}

	if (globalModel.isLoading || !globalModel.data) {
		return (
			<div className="flex h-full w-full items-center justify-center">
				<Spinner />
			</div>
		);
	}

	const derived = globalModel.data;
	const empty =
		derived.node_types.length === 0 && derived.edge_types.length === 0;

	return (
		<div className="flex h-full w-full flex-col overflow-y-auto">
			<div className="flex flex-col gap-1 border-b px-4 py-3">
				<h1 className="font-semibold text-lg">Global model</h1>
				<p className="max-w-3xl text-meta text-muted-foreground">
					The union of every published model plus its stitches, computed on
					read. There is no row behind it and nothing here can be edited. It is
					stated, not drawn — a global type carries no endpoints, so there is no
					shape to lay out. The drawing is{" "}
					<span className="text-foreground">All models</span>, next door.
				</p>
			</div>

			<div className="p-4">
				<MetricGrid minTileWidth={140}>
					<MetricTile
						label="node types"
						value={derived.node_types.length}
						caption={`across ${derived.model_count} ${derived.model_count === 1 ? "model" : "models"}`}
					/>
					<MetricTile
						label="edge types"
						value={derived.edge_types.length}
						caption={`across ${derived.model_count} ${derived.model_count === 1 ? "model" : "models"}`}
					/>
					{/* *Stitches*, not *links* — the surface says what a person did, and
					    `model_links` is what the engine stores once they have (ST13). */}
					<MetricTile
						label="stitches"
						value={derived.link_count}
						caption={`${derived.anchor_count} anchors · ${derived.relationship_count} relationships`}
					/>
					{/* Beside the derived counts, never added into them (ST7). What the
					    database holds is a fact about the database. */}
					<MetricTile
						label="physical mirror"
						value={derived.mirror_label_count}
						caption="labels introspected · never added in"
					/>
				</MetricGrid>
				{derived.staged_count > 0 ? (
					<p className="pt-2 text-meta text-warning">
						{derived.staged_count} staged — declared, and not in the union until
						somebody commits.
					</p>
				) : null}
			</div>

			{empty ? (
				<div className="flex flex-1 items-center justify-center p-6">
					<EmptyState
						icon={<Boxes />}
						title="Nothing published yet"
						description="The union spans published model versions. Publish a model and it appears here; publish a second and you can link them."
					/>
				</div>
			) : (
				<>
					<SectionHeader
						title="Node types"
						count={derived.node_types.length}
						// The section's own gloss, in its trailing slot — *anchored* is
						// the one word on this page that does not mean what it looks
						// like, so it is explained where it is first read.
						actions={
							<span className="text-meta text-muted-foreground">
								anchored means one entity across models — not a coincidence of
								naming
							</span>
						}
						bare
					/>
					<TypeList types={derived.node_types} />
					<SectionHeader
						title="Edge types"
						count={derived.edge_types.length}
						bare
					/>
					<TypeList types={derived.edge_types} />
				</>
			)}
		</div>
	);
}
