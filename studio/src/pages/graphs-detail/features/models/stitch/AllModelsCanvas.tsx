/**
 * All models — every published model on one canvas (stitch-models.md).
 *
 * The drawing is `GraphModelCanvas` (graph-model-canvas.md), the canvas
 * Storybook's GlobalModel story: a model is a group frame, its node types are
 * the members, and a **stitch is the only edge allowed to cross a frame** —
 * dashed, so it never reads as a traversal. The page adds no behaviour
 * of its own; it turns on the canvas's stitch gesture, and answers it
 * with the declare card docked beside the drawing. What sits above
 * the drawing is what a person has to *act* on: staged stitches to commit, and
 * stitches bound to a version no longer drawn. The union reads beside it:
 * this is the Model tab of the model page at All models (the-model-page.md).
 *
 * It does not write a model. Authoring is the model canvas, on a draft.
 */

import { Button, EmptyState, Spinner } from "@invana/ui";
import { AlertTriangle, Boxes, Check } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import {
	GraphModelCanvas,
	graphModelSettings,
	graphModelTemplates,
} from "@/canvases/model";
import type { CanvasBackend } from "@/pages/graphs-detail/features/explorer";
import {
	useCommitStitchesMutation,
	useDiscardStitchesMutation,
} from "@/pages/graphs-detail/features/models/queries";
import {
	buildAllModelsData,
	parseMemberId,
} from "@/pages/graphs-detail/features/models/stitch/allModels";
import { DeclareStitchCard } from "@/pages/graphs-detail/features/models/stitch/components/DeclareStitchCard";
import { UnionList } from "@/pages/graphs-detail/features/models/stitch/UnionList";
import { useAllModels } from "@/pages/graphs-detail/features/models/stitch/useAllModels";
import type { LinkKind } from "@/pages/graphs-detail/features/models/types";

interface Props {
	username: string;
	graphSlug: string;
	/** The page's render backend — the canvas starts on it. */
	backend?: CanvasBackend;
}

export function AllModelsCanvas({ username, graphSlug, backend }: Props) {
	const { frames, links, isLoading, isError, error } = useAllModels(
		username,
		graphSlug,
	);
	const commit = useCommitStitchesMutation(username, graphSlug);
	const discard = useDiscardStitchesMutation(username, graphSlug);

	const build = useMemo(
		() => buildAllModelsData(frames, links),
		[frames, links],
	);

	const [declaring, setDeclaring] = useState<{
		kind: LinkKind;
		sourceKey: string;
		targetKey: string;
	} | null>(null);

	const versionOf = useMemo(() => {
		const out = new Map<string, string | null>();
		for (const f of frames) out.set(f.modelId, f.versionId);
		return out;
	}, [frames]);

	/** The drag names both ends; the card declares, the drag never does. */
	const onStitch = useCallback(
		(source: string, target: string): string | null => {
			const from = parseMemberId(source);
			const to = parseMemberId(target);
			if (!from || !to)
				return "A stitch joins two node types — drag from one type onto another.";
			if (from.modelId === to.modelId)
				// Inside one frame this would be an edge type, authored on its draft.
				return "Both types are in the same model. A stitch crosses a boundary — an edge inside one is that model's own edge type, authored on its draft.";
			const sourceVersion = versionOf.get(from.modelId);
			const targetVersion = versionOf.get(to.modelId);
			// a draft has nothing immutable to bind.
			if (!sourceVersion || !targetVersion)
				return "A stitch binds published versions. One of these models has nothing published yet.";
			setDeclaring({
				kind: "anchor",
				sourceKey: `${sourceVersion}::${from.typeName}`,
				targetKey: `${targetVersion}::${to.typeName}`,
			});
			return null;
		},
		[versionOf],
	);

	if (isError) {
		return (
			<div className="flex h-full w-full items-center justify-center p-6">
				<EmptyState
					icon={<AlertTriangle />}
					title="The models could not be read"
					description={
						error instanceof Error
							? error.message
							: "The engine did not answer for this graph."
					}
				/>
			</div>
		);
	}

	if (isLoading) {
		return (
			<div className="flex h-full w-full items-center justify-center">
				<Spinner />
			</div>
		);
	}

	if (frames.length === 0) {
		return (
			<div className="flex h-full w-full items-center justify-center p-6">
				<EmptyState
					icon={<Boxes />}
					title="No models yet"
					description="All models draws every model in this Graph. Author one, or import a starter, and it appears here as its own frame."
				/>
			</div>
		);
	}

	return (
		<div className="flex h-full min-h-0 w-full flex-col">
			{build.stagedCount > 0 ? (
				<div className="flex shrink-0 items-center gap-2.5 border-b bg-card py-1.5 pr-2 pl-3">
					<span className="size-1.5 rounded-full bg-warning" />
					<span className="text-sm">
						{build.stagedCount} staged{" "}
						<span className="text-muted-foreground">
							· the union is unchanged until you commit
						</span>
					</span>
					<span className="flex-1" />
					<Button
						size="xs"
						onClick={() => commit.mutate(undefined as never)}
						disabled={commit.isPending}
					>
						<Check />
						Commit
					</Button>
					<Button
						size="xs"
						variant="ghost"
						onClick={() => discard.mutate(undefined)}
						disabled={discard.isPending}
					>
						Discard
					</Button>
				</div>
			) : null}

			{/* Not a stitch that vanished — one whose version needs reviewing. */}
			{build.unresolvedStitches > 0 ? (
				<div className="flex shrink-0 items-center gap-2 border-b border-warning/35 bg-warning/10 px-3 py-1.5 text-sm">
					<span className="size-1.5 rounded-full bg-warning" />
					<span>
						A published version moved on —{" "}
						<span className="font-mono">
							{build.unresolvedStitches}{" "}
							{build.unresolvedStitches === 1 ? "stitch" : "stitches"} still
							bind an older one
						</span>
					</span>
				</div>
			) : null}

			<div className="flex min-h-0 flex-1 gap-3">
				<div className="min-h-0 min-w-0 flex-1">
					<GraphModelCanvas
						data={build.data}
						settings={graphModelSettings}
						templates={graphModelTemplates}
						title="All models"
						backend={backend}
						stitching={{
							onStitch,
							onClosePanel: () => setDeclaring(null),
							panel: declaring ? (
								<DeclareStitchCard
									key={`${declaring.sourceKey}:${declaring.targetKey}`}
									username={username}
									graphSlug={graphSlug}
									initialKind={declaring.kind}
									sourceKey={declaring.sourceKey}
									targetKey={declaring.targetKey}
									onClose={() => setDeclaring(null)}
									className="w-full p-3"
								/>
							) : null,
						}}
					/>
				</div>
				<UnionList username={username} graphSlug={graphSlug} />
			</div>
		</div>
	);
}
