/**
 * The Explorer's own left panel — what this graph holds, and what is selected.
 *
 * Three sections in one column (selection-and-the-panel.md): `NODE TYPES`,
 * `RELATIONSHIPS`, `SELECTED`. Each collapses and resizes independently, which
 * is what the hi-fi's `Explorer · …` artboards draw and what `PanelStack` is.
 *
 * The two type lists are the **canvas legend as well as a list**: every row's
 * dot is the colour the canvas paints that type with, so reading the drawing and
 * reading the list are the same act. The eye hides that type on the open canvas
 * and nothing else — no query re-runs, and the count on the row does not move
 * (SP7), because the count is graph-wide (SP6).
 */

import { useTypeCountsQuery } from "@/hooks/queries/useTypeCounts";
import { readProvenance } from "@/pages/graphs-detail/features/bring-data-in/ProvenanceBlock";
import { typeDotColor } from "@/pages/graphs-detail/features/explorer/typeColor";
import {
	hiddenNodeTypes,
	setNodeTypeHidden,
} from "@/pages/graphs-detail/features/explorer/visibility";
import { ListPanelChrome } from "@/pages/graphs-detail/shared/ListPanel";
import { useActiveWorld } from "@/pages/graphs-detail/shell/useActiveWorld";
import type { CanvasStyling } from "@/types/board";
import type { QueryResultItem } from "@/types/query";
import type { TypeCount } from "@/types/traversal";
import type { GraphCanvas, GraphLayer, GraphStore } from "@invana/graph";
import { PanelStack, ScrollArea, cn } from "@invana/ui";
import { Compass, Eye, EyeOff } from "lucide-react";
import {
	type ReactNode,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";

/**
 * A `PanelStack` section title that carries a count on its right.
 *
 * `PanelStackSection` has no separate slot for it: `headerActions` is a nav-item
 * list and stays hidden until hover, and the kit's guidance is that chrome which
 * must always read — a count — belongs in the title. A custom title node is
 * rendered as-is, so the label repeats the kit's own default header typography.
 */
const sectionTitle = (label: string, meta: ReactNode) => (
	<>
		<span className="truncate text-sm font-semibold uppercase tracking-wide">
			{label}
		</span>
		{meta ? (
			<span className="ml-auto shrink-0 pl-2 text-sm text-muted-foreground">
				{meta}
			</span>
		) : null}
	</>
);

interface Props {
	username: string | undefined;
	graphSlug: string | undefined;
	/** The live engine, when a canvas is open. Without one the eyes are inert. */
	canvas: GraphCanvas | null;
	/** What the canvas has selected — the `SELECTED` section's subject. */
	selected: QueryResultItem | null;
	/** Per-type colours the canvas was styled with; the dots follow them. */
	styling?: CanvasStyling;
	/** The open canvas's name, stated in the footer beside the totals. */
	canvasName?: string;
	/** Resolves a dataset id to its name for the provenance line. */
	modelName?: (modelId: string) => string | undefined;
	/** Collapse the panel, handing the freed width back to the canvas. */
	onClose?: () => void;
}

export function ExplorerTypesPanel({
	username,
	graphSlug,
	canvas,
	selected,
	styling,
	canvasName,
	modelName,
	onClose,
}: Props) {
	// The legend is the picked world's: denied types are absent, counts are
	// taken inside it (selection-and-the-panel.md SP11).
	const { lensId } = useActiveWorld();
	const counts = useTypeCountsQuery(username, graphSlug, lensId);
	const hidden = useHiddenTypes(canvas);
	const store = graphStoreOf(canvas);

	const nodes = counts.data?.nodes ?? [];
	const edges = counts.data?.edges ?? [];

	const toggle = useCallback(
		(type: string) => {
			if (!store) return;
			setNodeTypeHidden(store, type, !hidden.has(type));
		},
		[store, hidden],
	);

	// Only types the canvas actually holds can be hidden — an eye on a type that
	// is not drawn would be a control with nothing to act on.
	const drawn = useMemo(() => {
		if (!store) return new Set<string>();
		const seen = new Set<string>();
		for (const node of store.nodes()) if (node.type) seen.add(node.type);
		return seen;
	}, [store]);

	const shown = nodes.filter((t) => !hidden.has(t.name)).length;
	const hiddenCount = nodes.length - shown;
	const totalNodes = nodes
		.filter((t) => !hidden.has(t.name))
		.reduce((sum, t) => sum + (t.count ?? 0), 0);

	return (
		<ListPanelChrome
			title="Explorer"
			icon={Compass}
			onRefresh={() => void counts.refetch()}
			isRefreshing={counts.isFetching}
			refreshLabel="Recount the graph"
			searchable
			searchLabel="Search types"
			onClose={onClose}
			footer={
				<div className="flex items-center justify-between gap-2 border-t px-3 py-1.5 text-sm text-muted-foreground">
					<span className="tabular-nums">
						{shown} types · {totalNodes.toLocaleString()} nodes
					</span>
					{canvasName ? <span className="truncate">{canvasName}</span> : null}
				</div>
			}
		>
			{({ search }) => {
				const q = search.trim().toLowerCase();
				const matches = (t: TypeCount) =>
					!q || t.name.toLowerCase().includes(q);
				return (
					<PanelStack
						withHandle
						sections={[
							{
								id: "node-types",
								title: sectionTitle(
									"Node types",
									hiddenCount > 0
										? `${shown} shown · ${hiddenCount} hidden`
										: `${shown}`,
								),
								content: (
									<TypeList
										empty={
											counts.isLoading
												? "Counting…"
												: "No node types in this graph yet."
										}
										rows={nodes.filter(matches)}
										color={(name) =>
											typeDotColor(name, styling?.nodeTypes?.[name]?.color)
										}
										hidden={hidden}
										onToggle={drawn.size ? toggle : undefined}
										canToggle={(name) => drawn.has(name)}
									/>
								),
							},
							{
								id: "relationships",
								title: sectionTitle(
									"Relationships",
									<span className="tabular-nums">{edges.length}</span>,
								),
								content: (
									<TypeList
										empty={
											counts.isLoading
												? "Counting…"
												: "No relationships in this graph yet."
										}
										rows={edges.filter(matches)}
										color={(name) =>
											typeDotColor(name, styling?.edgeTypes?.[name]?.color)
										}
										mono
									/>
								),
							},
							{
								id: "selected",
								title: sectionTitle("Selected", selected?.label ?? null),
								content: (
									<SelectedBlock
										selected={selected}
										modelName={modelName}
										color={(name) =>
											typeDotColor(name, styling?.nodeTypes?.[name]?.color)
										}
									/>
								),
							},
						]}
					/>
				);
			}}
		</ListPanelChrome>
	);
}

// ── The two type lists ───────────────────────────────────────────────────────

function TypeList({
	rows,
	color,
	hidden,
	onToggle,
	canToggle,
	mono,
	empty,
}: {
	rows: TypeCount[];
	color: (name: string) => string;
	hidden?: ReadonlySet<string>;
	onToggle?: (name: string) => void;
	canToggle?: (name: string) => boolean;
	/** Relationship names are SHOUTED in the graph; keep them monospaced. */
	mono?: boolean;
	empty: string;
}) {
	if (rows.length === 0) {
		return <p className="px-3 py-2 text-sm text-muted-foreground">{empty}</p>;
	}
	return (
		<ScrollArea className="h-full">
			{rows.map((row) => {
				const isHidden = hidden?.has(row.name) ?? false;
				const togglable = onToggle && (canToggle?.(row.name) ?? true);
				return (
					<div
						key={row.name}
						className={cn(
							"flex h-[30px] items-center gap-2 px-3",
							isHidden && "text-muted-foreground",
						)}
					>
						<span
							aria-hidden
							className="h-[7px] w-[7px] shrink-0 rounded-full"
							style={{
								backgroundColor: color(row.name),
								opacity: isHidden ? 0.4 : 1,
							}}
						/>
						<span className={cn("truncate", mono && "font-mono text-sm")}>
							{row.name}
						</span>
						<span className="ml-auto flex items-center gap-2 text-sm text-muted-foreground tabular-nums">
							{/* A vendor that cannot count still names its types (SP8) — the
							    row shows a dash rather than a made-up zero. */}
							{row.count === null ? "—" : row.count.toLocaleString()}
							{togglable ? (
								<button
									type="button"
									onClick={() => onToggle?.(row.name)}
									title={
										isHidden
											? `Show ${row.name} on this canvas`
											: `Hide ${row.name} on this canvas`
									}
									aria-label={
										isHidden
											? `Show ${row.name} on this canvas`
											: `Hide ${row.name} on this canvas`
									}
									className="text-muted-foreground hover:text-foreground"
								>
									{isHidden ? (
										<EyeOff className="h-[13px] w-[13px]" />
									) : (
										<Eye className="h-[13px] w-[13px]" />
									)}
								</button>
							) : null}
						</span>
					</div>
				);
			})}
		</ScrollArea>
	);
}

// ── The selected element, stated short ───────────────────────────────────────

/**
 * Id, a summary of its telling properties, its relationship chips, and where it
 * came from. The full property table is `InspectorPanel` (SP9) — this
 * says which thing is selected, not everything about it.
 */
function SelectedBlock({
	selected,
	modelName,
	color,
}: {
	selected: QueryResultItem | null;
	modelName?: (modelId: string) => string | undefined;
	color: (name: string) => string;
}) {
	if (!selected) {
		return (
			<p className="px-3 py-2 text-sm text-muted-foreground">
				Click a node or edge — what it is, and where it came from, reads here.
			</p>
		);
	}
	const provenance = readProvenance(selected.properties);
	const summary = summarise(selected.properties);
	return (
		<ScrollArea className="h-full">
			<div className="flex flex-col gap-2 px-3 py-2">
				<div className="flex items-baseline gap-2">
					<span
						aria-hidden
						className="mt-1 h-[7px] w-[7px] shrink-0 rounded-full"
						style={{ backgroundColor: color(selected.label) }}
					/>
					<span className="truncate font-mono text-sm">{selected.id}</span>
					{summary ? (
						<span className="ml-auto shrink-0 text-sm text-muted-foreground">
							{summary}
						</span>
					) : null}
				</div>
				{provenance ? (
					<p className="text-sm text-muted-foreground">
						From model{" "}
						<span className="text-foreground">
							{modelName?.(provenance.modelId) ?? provenance.modelId}
						</span>
						{provenance.file ? ` · ${provenance.file}` : null}
					</p>
				) : (
					<p className="text-sm text-muted-foreground">
						No model recorded on this element.
					</p>
				)}
			</div>
		</ScrollArea>
	);
}

/** `thesis · long · intraday · 0.72` — the few properties worth a glance. */
function summarise(properties: Record<string, unknown>): string {
	return Object.entries(properties)
		.filter(([key, value]) => {
			if (key.startsWith("_")) return false;
			const t = typeof value;
			return t === "string" || t === "number" || t === "boolean";
		})
		.slice(0, 4)
		.map(([, value]) => String(value))
		.join(" · ");
}

// ── Board plumbing ──────────────────────────────────────────────────────────

function graphStoreOf(canvas: GraphCanvas | null): GraphStore | null {
	return canvas?.layers.get<GraphLayer>("graph")?.store ?? null;
}

/**
 * Which types are hidden right now, re-read when the canvas changes.
 *
 * The store is mutable and does not tell React anything, so this subscribes to
 * the events that can change the answer and coalesces them into one read per
 * frame — a bulk load emits one event per element, and re-scanning the store on
 * each would cost a rebuild per node.
 */
function useHiddenTypes(canvas: GraphCanvas | null): ReadonlySet<string> {
	const [rev, setRev] = useState(0);
	const frame = useRef<number | null>(null);

	useEffect(() => {
		const store = graphStoreOf(canvas);
		if (!store) return;
		const bump = () => {
			if (frame.current !== null) return;
			frame.current = requestAnimationFrame(() => {
				frame.current = null;
				setRev((r) => r + 1);
			});
		};
		const events = [
			"node:add",
			"node:remove",
			"node:update",
			"edge:add",
			"edge:remove",
		] as const;
		const unsubs = events.map((ev) => store.events.on(ev, bump));
		return () => {
			for (const off of unsubs) off();
			if (frame.current !== null) {
				cancelAnimationFrame(frame.current);
				frame.current = null;
			}
		};
	}, [canvas]);

	// biome-ignore lint/correctness/useExhaustiveDependencies: `rev` is the signal — the store is mutable, so re-reading it is exactly what a bump must cause.
	return useMemo(() => {
		const store = graphStoreOf(canvas);
		return store ? hiddenNodeTypes(store) : new Set<string>();
	}, [canvas, rev]);
}
