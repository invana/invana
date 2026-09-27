/**
 * All models — every published model on one canvas (stitch-models.md ST14).
 *
 * The drawing is `GraphModelCanvas` (graph-model-canvas.md), the canvas
 * Storybook's GlobalModel story: a model is a group frame, its node types are
 * the members, and a **stitch is the only edge allowed to cross a frame** —
 * dashed, so it never reads as a traversal (GM9). The page adds no behaviour
 * of its own (ST57); it turns on the canvas's stitch gesture, and answers it
 * with the declare card docked beside the drawing (ST19, ST34). What sits above
 * the drawing is what a person has to *act* on: staged stitches to commit, and
 * stitches bound to a version no longer drawn.
 *
 * It does not write a model. Authoring is the model canvas, on a draft (ME1).
 */

import {
	GraphModelCanvas,
	graphModelSettings,
	graphModelTemplates,
} from "@/canvases/model";
import {
	useCommitStitchesMutation,
	useDiscardStitchesMutation,
} from "@/hooks/queries/useModels";
import {
	buildAllModelsData,
	parseMemberId,
} from "@/pages/graphs-detail/features/connect-and-model/stitch/allModels";
import { DeclareStitchPanel } from "@/pages/graphs-detail/features/connect-and-model/stitch/components/DeclareStitchPanel";
import { useAllModels } from "@/pages/graphs-detail/features/connect-and-model/stitch/useAllModels";
import type { CanvasBackend } from "@/pages/graphs-detail/features/explorer";
import type { LinkKind } from "@/types/models";
import { Button, EmptyState, Spinner } from "@invana/ui";
import { AlertTriangle, Boxes, Check } from "lucide-react";
import { useCallback, useMemo, useState } from "react";

interface Props {
	username: string;
	graphSlug: string;
	/**
	 * Accepted from the page host; the canvas carries no gesture that opens a
	 * model (ST57) — the Models panel's list does.
	 */
	onOpenModel?: (modelId: string) => void;
	/** The page's render backend — the canvas starts on it (GM13). */
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

	/** The drag names both ends (ST19); the card declares, the drag never does. */
	const onStitch = useCallback(
		(source: string, target: string): string | null => {
			const from = parseMemberId(source);
			const to = parseMemberId(target);
			if (!from || !to)
				return "A stitch joins two node types — drag from one type onto another.";
			if (from.modelId === to.modelId)
				// Inside one frame this would be an edge type, authored on its draft (ME1).
				return "Both types are in the same model. A stitch crosses a boundary — an edge inside one is that model's own edge type, authored on its draft.";
			const sourceVersion = versionOf.get(from.modelId);
			const targetVersion = versionOf.get(to.modelId);
			// ST8 — a draft has nothing immutable to bind.
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

			{/* Not a stitch that vanished — one whose version needs reviewing (ST16). */}
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

			<div className="min-h-0 flex-1">
				<GraphModelCanvas
					data={build.data}
					settings={graphModelSettings}
					templates={graphModelTemplates}
					initialDetail="high"
					title="All models"
					backend={backend}
					stitching={{
						onStitch,
						onClosePanel: () => setDeclaring(null),
						panel: declaring ? (
							<DeclareStitchPanel
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
		</div>
	);
}
