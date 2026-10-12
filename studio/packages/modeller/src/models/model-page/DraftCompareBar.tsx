/**
 * The **Comparing** bar on the global canvas — board
 * `modeller.global_model.diff`.
 *
 * When a model has a draft, the bar floats over the map: the model's
 * published version → its draft, the draft's changes counted as added ·
 * changed · removed from `GET …/draft/review`, and *Review and publish*,
 * which opens that model's Publish confirm. With several drafts a select
 * picks the model. With none, nothing is drawn.
 *
 * It is `sticky`, not absolute: the panel box around the canvas clips its
 * overflow and so is the scrollport, and the box's body is content-height.
 * Pinned to the box's visible bottom, the bar stays on screen however tall
 * the canvas draws; an absolute bar would sit at the content's bottom, below it.
 *
 * Each model is asked for its draft review; one with no draft answers 404
 * and is left out.
 */

import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@invana/forms";
import { Card } from "@invana/ui";
import { ActButton } from "@invana-studio/shell";
import { useQueries } from "@tanstack/react-query";
import { ArrowRight } from "lucide-react";
import { useState } from "react";
import { modelsApi } from "../api";
import type { GraphModelSummary, PublishChange } from "../types";

/** A change's kind ends in what it did: `type_added`, `property_removed`. */
function counts(changes: PublishChange[]) {
	const added = changes.filter((c) => c.kind.endsWith("_added")).length;
	const removed = changes.filter((c) => c.kind.endsWith("_removed")).length;
	return { added, removed, changed: changes.length - added - removed };
}

export function DraftCompareBar({
	username,
	graphSlug,
	models,
	onReview,
}: {
	username: string;
	graphSlug: string;
	models: GraphModelSummary[];
	/** *Review and publish* — open the model's Publish confirm. */
	onReview: (modelId: string) => void;
}) {
	const reviews = useQueries({
		queries: models.map((m) => ({
			queryKey: ["models", username, graphSlug, m.id, "draft-review"],
			queryFn: () => modelsApi.draftReview(username, graphSlug, m.id),
			retry: false,
		})),
	});
	const drafts = models.flatMap((model, i) => {
		const review = reviews[i]?.data;
		return review ? [{ model, review }] : [];
	});
	const [picked, setPicked] = useState<string | null>(null);
	const current = drafts.find((d) => d.model.id === picked) ?? drafts[0];
	if (!current) return null;

	const { added, changed, removed } = counts(current.review.changes);
	const from = current.review.base_version
		? `${current.model.name} v${current.review.base_version}`
		: `${current.model.name} · nothing published`;

	return (
		<Card className="sticky bottom-4 z-10 mx-auto flex w-fit shrink-0 items-center gap-3 px-3 py-2 shadow-md">
			<span className="font-semibold">Comparing</span>
			{drafts.length > 1 ? (
				<Select value={current.model.id} onValueChange={(v) => setPicked(v)}>
					<SelectTrigger aria-label="Model with a draft" className="w-56">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						{drafts.map((d) => (
							<SelectItem key={d.model.id} value={d.model.id}>
								{d.review.base_version
									? `${d.model.name} v${d.review.base_version}`
									: d.model.name}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			) : (
				<span className="font-mono">{from}</span>
			)}
			<ArrowRight className="size-3.5 text-muted-foreground" />
			<span className="font-mono">draft</span>
			<span className="text-success">+ {added} added</span>
			<span className="text-warning">~ {changed} changed</span>
			<span className="text-destructive">− {removed} removed</span>
			{current.review.classification === "breaking" ? (
				<span className="text-warning">breaking</span>
			) : null}
			<ActButton
				area="model"
				size="sm"
				onClick={() => onReview(current.model.id)}
			>
				Review and publish
			</ActButton>
		</Card>
	);
}
