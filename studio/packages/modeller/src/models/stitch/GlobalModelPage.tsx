/**
 * The global model — `global_model:<graph>` in `Workbook` (modeller.md ›
 * The global model page).
 *
 * Every published model on one full-bleed canvas, stitches dashed, with the
 * union list — or the stitch inspector, while `?stitch=` names one — in the
 * page's own right column. *Show* draws all models or one; *Lens* opens a
 * world's page; a click on a type opens its type page, and a click on a stitch
 * inspects it. Staged stitches and stitches bound to an older version are bars
 * over the canvas.
 *
 * It does not write a model. Authoring is the model canvas, on a draft.
 */

import { Badge, Button, Card, EmptyState, Spinner } from "@invana/ui";
import {
	type CanvasBackend,
	GlobalModelBoard,
	type GlobalModelSelect,
	type ModelCanvasSelection,
} from "@invana-studio/canvases";
import { useLensesQuery } from "@invana-studio/core";
import { ActButton } from "@invana-studio/shell";
import { AlertTriangle, Boxes, Check } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { modelPagePath } from "../model-page/useModelsView";
import {
	useCommitStitchesMutation,
	useDiscardStitchesMutation,
	useGlobalModelQuery,
	useModelsQuery,
	useModelVersionQuery,
	useModelVersionsQuery,
	useVersionDiffQuery,
} from "../queries";
import type { VersionSummary } from "../types";
import { buildAllModelsData, parseMemberId } from "./allModels";
import { CompareBar } from "./CompareBar";
import { StitchInspector } from "./StitchInspector";
import { UnionList } from "./UnionList";
import { useAllModels } from "./useAllModels";

export interface GlobalModelPageProps {
	username: string;
	graphSlug: string;
	backend?: CanvasBackend;
}

const STITCH = "stitch";
const ALL = "all";
const NO_LENS = "none";
const STITCH_PREFIX = "stitch:";

/** The pair a compare opens on: active to draft, else the two newest published. */
function defaultPair(versions: VersionSummary[]) {
	const draft = versions.find((v) => v.status === "draft");
	const active = versions.find((v) => v.status === "active");
	if (draft && active) return { from: active.id, to: draft.id };
	const published = versions
		.filter((v) => v.status !== "draft")
		.sort((a, b) => b.created_at.localeCompare(a.created_at));
	return { from: published[1]?.id, to: published[0]?.id };
}

interface Compare {
	modelId: string;
	from?: string;
	to?: string;
}

export function GlobalModelPage({
	username,
	graphSlug,
	backend,
}: GlobalModelPageProps) {
	const navigate = useNavigate();
	const [params, setParams] = useSearchParams();
	const stitchId = params.get(STITCH);
	const { frames, links, isLoading, isError, error } = useAllModels(
		username,
		graphSlug,
	);
	const union = useGlobalModelQuery(username, graphSlug);
	const worlds = useLensesQuery(username, graphSlug, { kind: "world" });
	const commit = useCommitStitchesMutation(username, graphSlug);
	const discard = useDiscardStitchesMutation(username, graphSlug);
	const [show, setShow] = useState(ALL);
	const [compare, setCompare] = useState<Compare | null>(null);
	const models = useModelsQuery(username, graphSlug);
	const compareVersions = useModelVersionsQuery(
		username,
		graphSlug,
		compare?.modelId,
	);
	const versionList = useMemo(
		() => compareVersions.data ?? [],
		[compareVersions.data],
	);
	const pair = useMemo(() => {
		const d = defaultPair(versionList);
		return { from: compare?.from ?? d.from, to: compare?.to ?? d.to };
	}, [versionList, compare]);
	// One read for the bar's counts and the map's marks.
	const diff = useVersionDiffQuery(
		username,
		graphSlug,
		compare?.modelId,
		pair.to,
		pair.from,
	);
	const toTree = useModelVersionQuery(
		username,
		graphSlug,
		compare?.modelId,
		pair.to,
	);
	const fromTree = useModelVersionQuery(
		username,
		graphSlug,
		compare?.modelId,
		pair.from,
	);
	const openCompare = () => {
		const id =
			(models.data ?? []).find((m) => m.draft_version)?.id ??
			frames.find((f) => f.versionId)?.modelId;
		if (id) setCompare({ modelId: id });
	};

	const everything = useMemo(
		() => buildAllModelsData(frames, links),
		[frames, links],
	);
	const drawn = useMemo(
		() =>
			show === ALL
				? everything
				: buildAllModelsData(
						frames.filter((f) => f.modelId === show),
						links,
					),
		[everything, frames, links, show],
	);
	// A compare keeps the map and swaps the compared model's frame for its `to`
	// version, the types it removed kept from `from` so their chips have
	// something to sit beside.
	const compared = useMemo(() => {
		if (!compare || !toTree.data || !diff.data) return null;
		const frame = frames.find((f) => f.modelId === compare.modelId);
		const model = (models.data ?? []).find((m) => m.id === compare.modelId);
		const removed = new Set(
			diff.data.marks.filter((m) => m.mark === "removed").map((m) => m.type),
		);
		const keep = <T extends { name: string }>(
			now: T[],
			before: T[] | undefined,
		) => [...now, ...(before ?? []).filter((t) => removed.has(t.name))];
		const name = frame?.name ?? model?.name ?? "Model";
		const swapped = {
			modelId: compare.modelId,
			name,
			description: frame?.description ?? model?.description ?? "",
			versionId: pair.to ?? null,
			versionLabel: null,
			hue: frame?.hue ?? 1,
			nodeTypes: keep(toTree.data.node_types, fromTree.data?.node_types),
			edgeTypes: keep(toTree.data.edge_types, fromTree.data?.edge_types),
		};
		const shown =
			show === ALL ? frames : frames.filter((f) => f.modelId === show);
		const rest = shown.filter((f) => f.modelId !== compare.modelId);
		const built = buildAllModelsData([...rest, swapped], links);
		return { ...built.data, marks: diff.data.marks, markedModel: name };
	}, [
		compare,
		toTree.data,
		fromTree.data,
		diff.data,
		frames,
		links,
		show,
		models.data,
		pair.to,
	]);

	const inspect = useCallback(
		(id: string | null) =>
			setParams(
				(prev) => {
					const next = new URLSearchParams(prev);
					if (id) next.set(STITCH, id);
					else next.delete(STITCH);
					return next;
				},
				{ replace: true },
			),
		[setParams],
	);

	const selected = useMemo<ModelCanvasSelection>(
		() =>
			stitchId ? { kind: "edge", id: `${STITCH_PREFIX}${stitchId}` } : null,
		[stitchId],
	);
	const onSelect = useCallback(
		(selection: ModelCanvasSelection) => {
			if (!selection) {
				inspect(null);
				return;
			}
			if (selection.kind === "edge") {
				if (selection.id.startsWith(STITCH_PREFIX))
					inspect(selection.id.slice(STITCH_PREFIX.length));
				return;
			}
			const member = parseMemberId(selection.id);
			if (member)
				navigate(
					modelPagePath(username, graphSlug, member.modelId, {
						type: member.typeName,
					}),
				);
		},
		[inspect, navigate, username, graphSlug],
	);

	const selects = useMemo<GlobalModelSelect[]>(
		() => [
			{
				key: "show",
				label: "Show",
				value: show,
				options: {
					[ALL]: `all ${union.data?.model_count ?? frames.length} models`,
					...Object.fromEntries(frames.map((f) => [f.modelId, f.name])),
				},
				onChange: setShow,
			},
			{
				key: "lens",
				label: "Lens",
				value: NO_LENS,
				options: {
					[NO_LENS]: "none",
					...Object.fromEntries(
						(worlds.data?.items ?? []).map((w) => [w.id, w.display_name]),
					),
				},
				onChange: (id) => {
					if (id !== NO_LENS)
						navigate(`/u/${username}/${graphSlug}/modeller/worlds/${id}`);
				},
			},
		],
		[show, union.data, frames, worlds.data, navigate, username, graphSlug],
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
					description="The global model draws every model in this Graph. Author one, or import a starter, and it appears here as its own frame."
				/>
			</div>
		);
	}

	const summary = union.data
		? `${union.data.node_types.length} node · ${union.data.edge_types.length} edge types · ${union.data.link_count} stitches`
		: undefined;
	return (
		<div className="flex h-full min-h-0 w-full">
			<div className="relative min-h-0 min-w-0 flex-1">
				<GlobalModelBoard
					data={compared ?? drawn.data}
					title="Global model"
					summary={summary}
					selects={selects}
					selected={selected}
					onSelect={onSelect}
					backend={backend}
				>
					{compare ? (
						<CompareBar
							models={(models.data ?? [])
								.filter((m) => m.origin !== "introspected")
								.map((m) => ({ id: m.id, name: m.name }))}
							modelId={compare.modelId}
							onModel={(modelId) => setCompare({ modelId })}
							versions={versionList}
							from={pair.from}
							to={pair.to}
							onFrom={(from) => setCompare({ ...compare, from, to: pair.to })}
							onTo={(to) => setCompare({ ...compare, to, from: pair.from })}
							diff={diff.data}
							onReview={() =>
								navigate(
									modelPagePath(username, graphSlug, compare.modelId, {
										schema: true,
									}),
								)
							}
							onClose={() => setCompare(null)}
						/>
					) : (
						<Button size="xs" variant="outline" onClick={openCompare}>
							Compare
						</Button>
					)}
					{everything.stagedCount > 0 ? (
						<Card className="flex w-fit items-center gap-2.5 py-1.5 pr-2 pl-3 shadow-md">
							<span className="size-1.5 rounded-full bg-warning" />
							<span>
								{everything.stagedCount} staged{" "}
								<span className="text-muted-foreground">
									· the union is unchanged until you commit
								</span>
							</span>
							<ActButton
								area="model"
								size="xs"
								disabled={commit.isPending}
								onClick={() => commit.mutate(undefined as never)}
							>
								<Check />
								Commit
							</ActButton>
							<ActButton
								area="model"
								size="xs"
								variant="ghost"
								disabled={discard.isPending}
								onClick={() => discard.mutate(undefined)}
							>
								Discard
							</ActButton>
						</Card>
					) : null}
					{/* Not a stitch that vanished — one whose version needs reviewing. */}
					{everything.unresolvedStitches > 0 ? (
						<Card className="flex w-fit items-center gap-2 px-3 py-1.5 shadow-md">
							<Badge variant="soft" tone="warning" size="xs">
								older version
							</Badge>
							<span>
								A published version moved on — {everything.unresolvedStitches}{" "}
								{everything.unresolvedStitches === 1
									? "stitch still binds"
									: "stitches still bind"}{" "}
								an older one
							</span>
						</Card>
					) : null}
				</GlobalModelBoard>
			</div>
			<aside className="flex min-h-0 w-104 shrink-0 flex-col border-l bg-card">
				{stitchId ? (
					<StitchInspector
						key={stitchId}
						username={username}
						graphSlug={graphSlug}
						linkId={stitchId}
						onClose={() => inspect(null)}
					/>
				) : (
					<UnionList
						username={username}
						graphSlug={graphSlug}
						onOpenStitch={inspect}
					/>
				)}
			</aside>
		</div>
	);
}
