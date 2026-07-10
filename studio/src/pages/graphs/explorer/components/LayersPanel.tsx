// The Explorer's canvas Layers browser, docked in the left rail under
// `?settings=layers`. Lists every layer registered on the live `GraphCanvas`
// (background / graph / minimap …) as a file-tree, top layer first. The Graph
// layer expands into its painted contents grouped by node/edge type with live
// counts; each type expands into its individual elements. Each layer row carries
// a Photoshop-style visibility eye on the right; every layer/element row also has
// a right-click context menu (Focus · Select · Hide/Show).

import type {
	ClickSelectBehaviour,
	GraphCanvas,
	GraphLayer,
	GraphStore,
} from "@invana/graph";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
	type TreeItem,
	TreeView,
} from "@invana/ui";
import {
	ArrowRight,
	Circle,
	Crosshair,
	Eye,
	EyeOff,
	Image as ImageIcon,
	Layers,
	Map as MapIcon,
	MoreHorizontal,
	MousePointer2,
	Network,
	Spline,
} from "lucide-react";
import type {
	ElementType,
	MouseEvent as ReactMouseEvent,
	ReactNode,
} from "react";
import {
	useCallback,
	useEffect,
	useMemo,
	useReducer,
	useRef,
	useState,
} from "react";
import { HIDDEN_STATE_NAME } from "./ExplorerCanvas";
import { ListPanelChrome } from "./ListPanel";

interface Props {
	/** The live canvas engine (null until `<Canvas>` publishes it). */
	canvas: GraphCanvas | null;
	/** Collapse the panel (closes the shared `?settings=layers` rail key). */
	onClose?: () => void;
}

// "Focus" zooms in to at least this scale (matches the canvas context menu).
const FOCUS_ZOOM = 2;

// How many individual elements a type shows before collapsing the rest behind a
// "Show more". The design-kit TreeItem renders expanded by default, so an
// uncapped list would paint every node/edge of a large graph at once — on a
// 100k-node / 500k-edge canvas that would freeze the tab. "Show more" reveals
// another page on demand.
const DEFAULT_SHOWN = 15;
const REVEAL_STEP = 15;

// Property keys tried, in order, for a human-readable element label before
// falling back to the raw store id.
const NAME_KEYS = ["name", "title", "label", "displayName", "id"];

// What a right-click landed on. Type/group/"show more" rows have no menu.
type MenuTarget =
	| { kind: "node"; id: string }
	| { kind: "edge"; id: string }
	| { kind: "layer"; id: string };

interface RowCtx {
	limitFor: (typeKey: string) => number;
	onReveal: (typeKey: string) => void;
	onLeafClick: (kind: "node" | "edge", id: string) => void;
	refresh: () => void;
}

function elementLabel(data: unknown, fallback: string): string {
	if (data && typeof data === "object") {
		const rec = data as Record<string, unknown>;
		for (const key of NAME_KEYS) {
			const v = rec[key];
			if (typeof v === "string" && v.trim()) return v;
			if (typeof v === "number") return String(v);
		}
	}
	return fallback;
}

// Classes matching TreeItem's own `hover:bg-accent hover:text-accent-foreground`,
// applied imperatively to the right-clicked row so it stays highlighted while its
// context menu is open (the pointer moves to the menu and drops the hover). Done
// on the DOM node rather than via React state so opening the menu doesn't force a
// full store re-scan just to repaint one row.
const ACTIVE_ROW_CLASSES = ["bg-accent", "text-accent-foreground"];

// The label lives here, not in TreeItem's own `label` slot (left blank) — the
// slot renders before the row's controls and can't host a surface covering the
// whole row. Rendering the row body here also lets the trailing eye span the full
// width, Photoshop-style. The `data-menu-*` attributes let the wrapper's
// delegated right-click handler resolve which element this row targets, no matter
// where in the row (text, padding, blank space) the click lands.
function RowContent({
	icon,
	label,
	trailing,
	muted,
	menuTarget,
}: {
	icon: ReactNode;
	label: string;
	trailing?: ReactNode;
	muted?: boolean;
	menuTarget?: MenuTarget;
}) {
	return (
		<div
			className="flex min-w-0 flex-1 select-none items-center gap-2"
			data-menu-kind={menuTarget?.kind}
			data-menu-id={menuTarget?.id}
		>
			{icon}
			{/* `min-w-0` is essential: without it `flex-1` keeps `min-width:auto`, so a
			    long single-line id (a hash) can't shrink and forces the row wider than
			    the panel instead of truncating — which read as leaves being over-
			    indented next to the short group / "Show more" labels. `text-left` keeps
			    it hugging the icon. */}
			<span
				title={label}
				className={`min-w-0 flex-1 truncate text-left ${muted ? "text-muted-foreground/50 line-through" : ""}`}
			>
				{label}
			</span>
			{trailing}
		</div>
	);
}

// A per-layer eye toggle in the row's trailing slot. Stops propagation so the
// flip stays independent of the row's expand/collapse and context menu.
function VisibilityToggle({
	visible,
	label,
	onToggle,
}: {
	visible: boolean;
	label: string;
	onToggle: () => void;
}) {
	const Icon = visible ? Eye : EyeOff;
	return (
		// biome-ignore lint/a11y/useSemanticElements: nested inside TreeItem's row <button>, where a real <button> would be invalid interactive nesting; role="button" span is the accessible fallback
		<span
			role="button"
			tabIndex={0}
			aria-label={`${visible ? "Hide" : "Show"} ${label} layer`}
			title={visible ? "Hide layer" : "Show layer"}
			onClick={(e) => {
				e.stopPropagation();
				onToggle();
			}}
			onKeyDown={(e) => {
				if (e.key === "Enter" || e.key === " ") {
					e.preventDefault();
					e.stopPropagation();
					onToggle();
				}
			}}
			className={`grid h-5 w-5 shrink-0 place-items-center rounded hover:bg-accent ${
				visible ? "text-foreground" : "text-muted-foreground/60"
			}`}
		>
			<Icon className="h-3.5 w-3.5" />
		</span>
	);
}

interface GroupOpts<T> {
	prefix: string;
	kind: "node" | "edge";
	typeIcon: ElementType;
	leafIcon: ElementType;
	labelOf: (el: T) => string;
	isHidden: (el: T) => boolean;
	ctx: RowCtx;
}

// Group an iterable of graph elements by `type` into sorted "type · count"
// branches, each expanding into its (capped) individual elements.
//
// Scale note: we iterate the source exactly once and keep at most `limit`
// elements per type in memory — we never materialise the full 500k-edge set
// into arrays. Cost is O(total) time, O(#types × shown) memory, so a huge canvas
// stays cheap. Counts are still exact because we tally every element.
function groupByType<T extends { id: string; type?: string }>(
	entries: Iterable<T>,
	opts: GroupOpts<T>,
): { groups: TreeItem[]; total: number } {
	const { prefix, kind, typeIcon, leafIcon, labelOf, isHidden, ctx } = opts;
	const counts = new Map<string, number>();
	const samples = new Map<string, T[]>();
	let total = 0;
	for (const el of entries) {
		total += 1;
		const type = el.type ?? "(untyped)";
		counts.set(type, (counts.get(type) ?? 0) + 1);
		let bucket = samples.get(type);
		if (!bucket) {
			bucket = [];
			samples.set(type, bucket);
		}
		if (bucket.length < ctx.limitFor(`${prefix}:${type}`)) bucket.push(el);
	}
	const TypeIcon = typeIcon;
	const LeafIcon = leafIcon;
	const groups: TreeItem[] = [...counts.entries()]
		.sort((a, b) => a[0].localeCompare(b[0]))
		.map(([type, count]) => {
			const key = `${prefix}:${type}`;
			const shown = samples.get(type) ?? [];
			const children: TreeItem[] = shown.map((el) => {
				const id = String(el.id);
				const hidden = isHidden(el);
				return {
					id: `${key}:${id}`,
					label: "",
					icon: (
						<RowContent
							icon={
								hidden ? (
									<EyeOff className="h-3 w-3 shrink-0 text-muted-foreground/50" />
								) : (
									<LeafIcon className="h-3 w-3 shrink-0 text-muted-foreground/70" />
								)
							}
							label={labelOf(el)}
							muted={hidden}
							menuTarget={{ kind, id }}
						/>
					),
					onClick: () => ctx.onLeafClick(kind, id),
				};
			});
			const remaining = count - children.length;
			if (remaining > 0) {
				children.push({
					id: `${key}:__more`,
					label:
						remaining <= REVEAL_STEP
							? `Show ${remaining} more`
							: `Show ${REVEAL_STEP} more of ${remaining}`,
					icon: <MoreHorizontal className="h-3 w-3 text-muted-foreground/50" />,
					onClick: () => ctx.onReveal(key),
				});
			}
			return {
				id: key,
				label: `${type} · ${count}`,
				icon: <TypeIcon key={type} className="h-3 w-3 text-muted-foreground" />,
				children,
			};
		});
	return { groups, total };
}

// Friendly label + icon per known layer id. Layer *ids* are stable (set in
// ExplorerCanvas: "background" / "graph" / "minimap"); class names get mangled
// in production builds, so we key off the id rather than `constructor.name`.
const LAYER_META: Record<string, { label: string; icon: ElementType }> = {
	graph: { label: "Graph", icon: Network },
	background: { label: "Background", icon: ImageIcon },
	minimap: { label: "Minimap", icon: MapIcon },
};

// Derive the layer tree from the live canvas. Layer ids are stable, so the
// TreeView keys off them and preserves each row's expand state across renders.
function buildItems(canvas: GraphCanvas | null, ctx: RowCtx): TreeItem[] {
	if (!canvas) return [];
	// Top layer first (byZOrder is low → high), mirroring how layers stack on
	// screen and how design tools list them.
	const layers = [...canvas.layers.byZOrder()].reverse();
	return layers.map((layer) => {
		const meta = LAYER_META[layer.id] ?? { label: layer.id, icon: Layers };
		const LayerIcon = meta.icon;

		// The graph layer expands into its painted contents grouped by type.
		let children: TreeItem[] | undefined;
		if (layer.id === "graph") {
			const store = canvas.layers.get<GraphLayer>("graph")?.store;
			if (store) {
				const nodes = groupByType(store.nodes(), {
					prefix: "graph:node",
					kind: "node",
					typeIcon: Circle,
					leafIcon: Circle,
					labelOf: (n) => elementLabel(n.data, String(n.id)),
					isHidden: (n) => store.hasNodeState(String(n.id), HIDDEN_STATE_NAME),
					ctx,
				});
				const edges = groupByType(store.edges(), {
					prefix: "graph:edge",
					kind: "edge",
					typeIcon: Spline,
					leafIcon: ArrowRight,
					labelOf: (e) => `${e.source} → ${e.target}`,
					isHidden: (e) => store.hasEdgeState(String(e.id), HIDDEN_STATE_NAME),
					ctx,
				});
				children = [
					{
						id: "graph:nodes",
						label: `Nodes · ${nodes.total}`,
						icon: <Circle className="h-3.5 w-3.5 text-muted-foreground" />,
						children: nodes.groups,
					},
					{
						id: "graph:edges",
						label: `Edges · ${edges.total}`,
						icon: <Spline className="h-3.5 w-3.5 text-muted-foreground" />,
						children: edges.groups,
					},
				];
			}
		}

		return {
			id: layer.id,
			label: "",
			icon: (
				<RowContent
					icon={
						<LayerIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
					}
					label={meta.label}
					menuTarget={{ kind: "layer", id: layer.id }}
					trailing={
						<VisibilityToggle
							visible={layer.visible}
							label={meta.label}
							onToggle={() => {
								layer.visible = !layer.visible;
								layer.redraw();
								ctx.refresh();
							}}
						/>
					}
				/>
			),
			children,
		} satisfies TreeItem;
	});
}

// ── Canvas actions ───────────────────────────────────────────────────────────

function graphRefs(canvas: GraphCanvas | null) {
	const layer = canvas?.layers.get<GraphLayer>("graph") ?? undefined;
	const select =
		canvas?.behaviours.get<ClickSelectBehaviour>("click-select") ?? undefined;
	return { layer, store: layer?.store, select };
}

function selectElement(
	canvas: GraphCanvas | null,
	kind: "node" | "edge",
	id: string,
) {
	graphRefs(canvas).select?.select(id, kind === "node" ? "shape" : "connector");
}

function focusElement(
	canvas: GraphCanvas | null,
	kind: "node" | "edge",
	id: string,
) {
	const { layer, select } = graphRefs(canvas);
	if (kind === "node") {
		select?.select(id, "shape");
		layer?.focusNode(id, { zoom: FOCUS_ZOOM });
	} else {
		select?.select(id, "connector");
		layer?.focusEdges([id]);
	}
}

// Hide/show a single node by toggling the sticky `hidden` overlay (registered on
// the layer in ExplorerCanvas). Incident edges follow so nothing dangles to an
// invisible endpoint; on show, an edge only reappears if its other end is
// visible. One batch → one flush → one paint.
function setNodeHidden(store: GraphStore, id: string, hidden: boolean) {
	store.batch(() => {
		store.setNodeState(id, HIDDEN_STATE_NAME, hidden);
		for (const e of store.edgesOf(id, "both")) {
			if (hidden) {
				store.setEdgeState(e.id, HIDDEN_STATE_NAME, true);
			} else {
				const other = e.source === id ? e.target : e.source;
				if (!store.hasNodeState(other, HIDDEN_STATE_NAME)) {
					store.setEdgeState(e.id, HIDDEN_STATE_NAME, false);
				}
			}
		}
	});
}

// ── Context menu ─────────────────────────────────────────────────────────────

function ContextMenuItems({
	canvas,
	target,
	refresh,
}: {
	canvas: GraphCanvas | null;
	target: MenuTarget;
	refresh: () => void;
}) {
	if (target.kind === "layer") {
		const layer = canvas?.layers.get(target.id);
		const visible = layer?.visible ?? true;
		return (
			<DropdownMenuContent align="start" className="w-44">
				{target.id === "graph" && (
					<DropdownMenuItem
						onSelect={() => {
							const g = canvas?.layers.get<GraphLayer>("graph");
							if (g && canvas) canvas.camera.fitContent(g.getBounds(), 80);
						}}
					>
						<Crosshair className="mr-2 h-4 w-4" /> Focus layer
					</DropdownMenuItem>
				)}
				<DropdownMenuItem
					onSelect={() => {
						if (layer) {
							layer.visible = !layer.visible;
							layer.redraw();
						}
						refresh();
					}}
				>
					{visible ? (
						<>
							<EyeOff className="mr-2 h-4 w-4" /> Hide layer
						</>
					) : (
						<>
							<Eye className="mr-2 h-4 w-4" /> Show layer
						</>
					)}
				</DropdownMenuItem>
			</DropdownMenuContent>
		);
	}

	const { kind, id } = target;
	const store = graphRefs(canvas).store;
	const hidden =
		kind === "node"
			? (store?.hasNodeState(id, HIDDEN_STATE_NAME) ?? false)
			: (store?.hasEdgeState(id, HIDDEN_STATE_NAME) ?? false);
	const noun = kind === "node" ? "node" : "edge";
	return (
		<DropdownMenuContent align="start" className="w-44">
			<DropdownMenuItem onSelect={() => focusElement(canvas, kind, id)}>
				<Crosshair className="mr-2 h-4 w-4" /> Focus on {noun}
			</DropdownMenuItem>
			<DropdownMenuItem onSelect={() => selectElement(canvas, kind, id)}>
				<MousePointer2 className="mr-2 h-4 w-4" /> Select {noun}
			</DropdownMenuItem>
			<DropdownMenuSeparator />
			<DropdownMenuItem
				onSelect={() => {
					if (!store) return;
					if (kind === "node") setNodeHidden(store, id, !hidden);
					else store.setEdgeState(id, HIDDEN_STATE_NAME, !hidden);
					refresh();
				}}
			>
				{hidden ? (
					<>
						<Eye className="mr-2 h-4 w-4" /> Show {noun}
					</>
				) : (
					<>
						<EyeOff className="mr-2 h-4 w-4" /> Hide {noun}
					</>
				)}
			</DropdownMenuItem>
		</DropdownMenuContent>
	);
}

export function LayersPanel({ canvas, onClose }: Props) {
	// Layers/store are live mutable canvas state, not React state — bumping `rev`
	// re-derives the tree. `rev` is a dependency of the memo below, never read.
	const [rev, bumpRev] = useReducer((n: number) => n + 1, 0);

	// Cursor-anchored context menu (there's no ContextMenu component in the design
	// kit, so a controlled DropdownMenu is opened at the click point).
	const [menu, setMenu] = useState<{
		x: number;
		y: number;
		target: MenuTarget;
	} | null>(null);

	// The row button currently kept highlighted while its menu is open.
	const activeRowRef = useRef<HTMLElement | null>(null);
	const clearActiveRow = useCallback(() => {
		activeRowRef.current?.classList.remove(...ACTIVE_ROW_CLASSES);
		activeRowRef.current = null;
	}, []);
	// One delegated right-click handler for the whole tree. Resolving the target
	// from the row `<button>` (rather than an `onContextMenu` per row body) means a
	// click anywhere in the row — text, icon, padding, blank space — hits it, and
	// the native browser menu is always suppressed inside the tree.
	const handleContextMenu = useCallback(
		(e: ReactMouseEvent<HTMLElement>) => {
			e.preventDefault();
			clearActiveRow();
			const row = (e.target as HTMLElement).closest("button");
			const holder = row?.querySelector<HTMLElement>("[data-menu-id]");
			const kind = holder?.dataset.menuKind as MenuTarget["kind"] | undefined;
			const id = holder?.dataset.menuId;
			// Rows without a menu (group / type / "Show more") still land here so the
			// native menu is suppressed, but open nothing.
			if (!row || !kind || !id) {
				setMenu(null);
				return;
			}
			row.classList.add(...ACTIVE_ROW_CLASSES);
			activeRowRef.current = row;
			setMenu({
				x: e.clientX,
				y: e.clientY,
				target: { kind, id } as MenuTarget,
			});
		},
		[clearActiveRow],
	);

	const onLeafClick = useCallback(
		(kind: "node" | "edge", id: string) => selectElement(canvas, kind, id),
		[canvas],
	);

	// Per-type reveal counts (progressive disclosure). Held in a ref so they
	// survive tree rebuilds; changing one bumps `rev` to re-derive.
	const shownRef = useRef<Map<string, number>>(new Map());
	const limitFor = useCallback(
		(typeKey: string) => shownRef.current.get(typeKey) ?? DEFAULT_SHOWN,
		[],
	);
	const reveal = useCallback((typeKey: string) => {
		const cur = shownRef.current.get(typeKey) ?? DEFAULT_SHOWN;
		shownRef.current.set(typeKey, cur + REVEAL_STEP);
		bumpRev();
	}, []);

	// Coalesce store churn into one rebuild per frame. A bulk load emits one
	// event per element (100k nodes → 100k events); without this each would
	// trigger a full re-scan of the store. The rAF guard collapses them to a
	// single rebuild after the batch settles.
	const frameRef = useRef<number | null>(null);
	const scheduleRebuild = useCallback(() => {
		if (frameRef.current !== null) return;
		frameRef.current = requestAnimationFrame(() => {
			frameRef.current = null;
			bumpRev();
		});
	}, []);

	useEffect(() => {
		const store = canvas?.layers.get<GraphLayer>("graph")?.store;
		if (!store) return;
		const events = [
			"node:add",
			"node:remove",
			"edge:add",
			"edge:remove",
		] as const;
		const unsubs = events.map((ev) => store.events.on(ev, scheduleRebuild));
		return () => {
			for (const off of unsubs) off();
			if (frameRef.current !== null) {
				cancelAnimationFrame(frameRef.current);
				frameRef.current = null;
			}
		};
	}, [canvas, scheduleRebuild]);

	const ctx = useMemo<RowCtx>(
		() => ({ limitFor, onReveal: reveal, onLeafClick, refresh: bumpRev }),
		[limitFor, reveal, onLeafClick],
	);

	// Memoised so unrelated parent re-renders don't re-scan the store; recomputes
	// only when the canvas swaps, `rev` bumps (mutation settle / reveal / toggle /
	// menu action), or the row context changes.
	// biome-ignore lint/correctness/useExhaustiveDependencies: `rev` is the rebuild signal — the tree reads live mutable canvas/store state, so `rev` (not the state itself) is what invalidates the memo.
	const items = useMemo(() => buildItems(canvas, ctx), [canvas, ctx, rev]);

	return (
		<ListPanelChrome
			tab={{ value: "layers", label: "Layers", icon: Layers }}
			onRefresh={bumpRev}
			refreshLabel="Refresh layers"
			onClose={onClose}
			listControls={false}
		>
			{() =>
				items.length === 0 ? (
					<div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center text-muted-foreground">
						<Layers className="h-6 w-6" />
						<p className="text-sm">No canvas layers</p>
						<p className="text-xs">Open a session to paint a canvas.</p>
					</div>
				) : (
					<div
						className="h-full overflow-auto p-2"
						onContextMenu={handleContextMenu}
					>
						<TreeView
							items={items}
							className="w-full border-0 bg-transparent p-0 shadow-none"
						/>
						<DropdownMenu
							open={menu !== null}
							onOpenChange={(open) => {
								if (!open) {
									clearActiveRow();
									setMenu(null);
								}
							}}
						>
							<DropdownMenuTrigger asChild>
								<span
									aria-hidden
									className="pointer-events-none fixed h-0 w-0"
									style={{ left: menu?.x ?? 0, top: menu?.y ?? 0 }}
								/>
							</DropdownMenuTrigger>
							{menu && (
								<ContextMenuItems
									canvas={canvas}
									target={menu.target}
									refresh={bumpRev}
								/>
							)}
						</DropdownMenu>
					</div>
				)
			}
		</ListPanelChrome>
	);
}
