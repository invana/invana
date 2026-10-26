/**
 * The stitch inspector — the global model's right column while a stitch is
 * selected (`?stitch=<id>`), in place of the union list.
 *
 * The pair with its kind, then three tabs: **Stitch** (each end with its
 * records, what the stitch holds in the graph now, who declared it),
 * **Crossed by** (the 30-day queries) and **History** (its declare and commit
 * events, oldest first). Every number is the engine's; this only formats them.
 */

import {
	Badge,
	Button,
	EmptyState,
	Eyebrow,
	Legend,
	LegendItem,
	PropertyList,
	PropertyRow,
	RecordHeader,
	Spinner,
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
} from "@invana/ui";
import { hueSlotForName } from "@invana-studio/canvases";
import {
	formatGrouped,
	formatRelativeTime,
	formatShortDate,
} from "@invana-studio/core";
import { ActButton } from "@invana-studio/shell";
import { Link2, Trash2, X } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { modelPagePath } from "../model-page/useModelsView";
import {
	useModelInsightsQuery,
	useModelLinkQuery,
	useModelsQuery,
	useRemoveLinkMutation,
} from "../queries";
import type { ModelLink, StitchEvent } from "../types";
import { stitchPair, stitchRule } from "./allModels";
import { RemoveStitchDialog } from "./components/RemoveStitchDialog";
import { holds } from "./stitchText";

interface StitchInspectorProps {
	username: string;
	graphSlug: string;
	linkId: string;
	/** ✕ — back to the union list. */
	onClose: () => void;
}

const EVENT_LABEL: Record<string, string> = {
	"model_link.declare": "Declared",
	"model_link.commit": "Committed",
};

/** `Country ≡ country` — the pair without its models, as the head names it. */
const shortPair = (link: ModelLink) => stitchPair(link, false);

const records = (n: number | null) =>
	n === null ? "not counted" : `${formatGrouped(n)} records`;

/** An end's dot is its model's hue, the colour the map draws it in. */
const hue = (model: string | null) =>
	`var(--color-data-${hueSlotForName(model ?? "?")})`;

export function StitchInspector({
	username,
	graphSlug,
	linkId,
	onClose,
}: StitchInspectorProps) {
	const navigate = useNavigate();
	const stitch = useModelLinkQuery(username, graphSlug, linkId);
	const models = useModelsQuery(username, graphSlug);
	const insights = useModelInsightsQuery(username, graphSlug, null, "30d");
	const remove = useRemoveLinkMutation(username, graphSlug);
	const [removing, setRemoving] = useState<ModelLink | null>(null);

	if (stitch.isLoading) {
		return (
			<div className="flex h-full items-center justify-center">
				<Spinner />
			</div>
		);
	}
	const link = stitch.data;
	if (!link) {
		return (
			<div className="flex h-full flex-col">
				<RecordHeader
					variant="page"
					size="md"
					icon={<Link2 />}
					crumbs={["Stitch"]}
					actions={<CloseButton onClose={onClose} />}
				/>
				<EmptyState
					className="flex-1"
					title="This stitch is not here"
					description="It was removed, or it is not in this Graph. The union list is back one step."
				/>
			</div>
		);
	}

	const sourceModel = (models.data ?? []).find(
		(m) => m.id === link.source_model_id,
	);
	// The model whose draft the stitch is edited from — its source end.
	const openable = (models.data ?? []).find(
		(m) => m.name === link.source_model,
	);
	const usage = insights.data?.usage ?? null;
	const crossing = usage?.stitches.find((s) => s.id === link.id) ?? null;
	const crossed = !usage
		? "—"
		: crossing && crossing.queries > 0
			? `${formatGrouped(crossing.queries)} ${crossing.queries === 1 ? "query" : "queries"}`
			: "0 · never crossed";

	return (
		<div className="flex h-full min-h-0 flex-col">
			<RecordHeader
				variant="page"
				size="md"
				icon={<Link2 />}
				crumbs={[shortPair(link)]}
				chips={
					<>
						<Badge variant="outline" size="xs">
							{link.kind}
						</Badge>
						{link.status === "staged" ? (
							<Badge variant="soft" tone="warning" size="xs">
								staged
							</Badge>
						) : null}
					</>
				}
				actions={<CloseButton onClose={onClose} />}
			/>

			<Tabs
				size="sm"
				defaultValue="stitch"
				className="flex min-h-0 flex-1 flex-col"
			>
				<TabsList className="shrink-0 justify-start border-b px-3">
					<TabsTrigger value="stitch">Stitch</TabsTrigger>
					<TabsTrigger value="crossed">Crossed by</TabsTrigger>
					<TabsTrigger value="history">History</TabsTrigger>
				</TabsList>

				<TabsContent
					value="stitch"
					className="mt-0 min-h-0 flex-1 overflow-y-auto"
				>
					<div className="flex flex-col gap-3 p-3">
						<section className="flex flex-col gap-1">
							<Eyebrow>Ends</Eyebrow>
							<Legend orientation="column">
								<LegendItem
									color={hue(link.source_model)}
									label={`${link.source_model ?? "?"}.${link.source_type}`}
									count={records(link.source_records)}
								/>
								<LegendItem
									color={hue(link.target_model)}
									label={`${link.target_model ?? "?"}.${link.target_type}`}
									count={records(link.target_records)}
								/>
							</Legend>
						</section>

						<section className="flex flex-col gap-1">
							<Eyebrow>Joins on</Eyebrow>
							<PropertyList>
								<PropertyRow label="match" mono>
									{stitchRule(
										link,
										sourceModel?.name ?? link.source_model ?? undefined,
									)}
								</PropertyRow>
								<PropertyRow
									label={link.kind === "anchor" ? "joined" : "holds"}
									mono
								>
									{holds(link, link.source_records)}
								</PropertyRow>
							</PropertyList>
						</section>

						<section className="flex flex-col gap-1">
							<Eyebrow aside="30 days">Crossed by queries</Eyebrow>
							<PropertyList>
								<PropertyRow label="queries" mono>
									{crossed}
								</PropertyRow>
								<PropertyRow label="declared" mono>
									{[
										link.declared_by,
										link.declared_at
											? formatShortDate(new Date(link.declared_at))
											: null,
									]
										.filter(Boolean)
										.join(" · ") || "—"}
								</PropertyRow>
							</PropertyList>
						</section>

						<div className="flex items-center gap-2">
							<ActButton
								area="model"
								size="sm"
								variant="outline"
								disabled={!openable}
								title="Open the source model's schema canvas on its draft"
								onClick={() =>
									openable &&
									navigate(
										modelPagePath(username, graphSlug, openable.id, {
											schema: true,
										}),
									)
								}
							>
								Open in a draft
							</ActButton>
							<ActButton
								area="model"
								size="sm"
								variant="ghost"
								onClick={() => setRemoving(link)}
							>
								<Trash2 />
								Remove stitch
							</ActButton>
						</div>
					</div>
				</TabsContent>

				<TabsContent
					value="crossed"
					className="mt-0 min-h-0 flex-1 overflow-y-auto"
				>
					<div className="p-3">
						{!usage ? (
							<p className="text-sm text-muted-foreground">
								The 30-day queries are being read.
							</p>
						) : (
							<PropertyList>
								<PropertyRow label="queries" mono>
									{crossed}
								</PropertyRow>
								<PropertyRow label="share" mono>
									{crossing ? `${Math.round(crossing.share * 100)}%` : "—"}
								</PropertyRow>
								<PropertyRow label="last crossed" mono>
									{crossing?.last_crossed
										? formatRelativeTime(new Date(crossing.last_crossed))
										: "never"}
								</PropertyRow>
							</PropertyList>
						)}
					</div>
				</TabsContent>

				<TabsContent
					value="history"
					className="mt-0 min-h-0 flex-1 overflow-y-auto"
				>
					<div className="p-3">
						{link.history.length ? (
							<PropertyList labelWidth={84}>
								{link.history.map((e: StitchEvent) => (
									<PropertyRow
										key={`${e.action}:${e.at}`}
										label={EVENT_LABEL[e.action] ?? e.action}
										mono
									>
										{e.actor ?? "—"} · {formatRelativeTime(new Date(e.at))}
									</PropertyRow>
								))}
							</PropertyList>
						) : (
							<p className="text-sm text-muted-foreground">
								No events are recorded for this stitch.
							</p>
						)}
					</div>
				</TabsContent>
			</Tabs>

			<RemoveStitchDialog
				link={removing}
				sourceModel={sourceModel?.name}
				onConfirm={(l) => {
					remove.mutate(l.id, { onSuccess: onClose });
					setRemoving(null);
				}}
				onOpenChange={(open) => {
					if (!open) setRemoving(null);
				}}
			/>
		</div>
	);
}

function CloseButton({ onClose }: { onClose: () => void }) {
	return (
		<Button
			variant="ghost"
			size="icon-xs"
			aria-label="Close the stitch"
			onClick={onClose}
		>
			<X />
		</Button>
	);
}
