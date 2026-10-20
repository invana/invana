/**
 * The Explorer's header toolbar — history, select mode, layout picker, edge
 * routing, zoom and lock, grid, render backend and the magnet. Shown in the app
 * header while a data board is open outside the Explorer product; the board's
 * own row carries the same verbs on the board.
 *
 * Undo / redo read `canvas.history`, so no provider is needed; it renders only
 * once the engine is live. The Modeller's read-only canvas reuses it with
 * `showMagnet={false}` and `showHistory={false}`.
 */

import {
	canUseWebGPU,
	type LayoutFactory,
	useCanvas,
	useGrid,
	useHistorySection,
	useLayout,
	useSelectMode,
	useStyleEditorSection,
	useViewSection,
} from "@invana/canvas-react";
import {
	applyIconOverrides,
	type ToolbarItem,
	ToolbarItems,
} from "@invana/canvas-ui";
import { D3ForceLayout as D3ForceLayoutEngine } from "@invana/graph-layout-d3-force";
import { ElkLayout } from "@invana/graph-layout-elkjs";
import {
	cn,
	RichSelect,
	type RichSelectOption,
	ToggleGroup,
	ToggleGroupItem,
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@invana/ui";
import type { CanvasBackend } from "@invana-studio/canvases";
import {
	Cable,
	CornerDownRight,
	Grid3x3,
	Lasso,
	Lock,
	LockOpen,
	type LucideIcon,
	Magnet,
	Maximize,
	Minus,
	MousePointer2,
	Network,
	Orbit,
	Play,
	Redo2,
	RefreshCw,
	Share2,
	Spline,
	SquareDashedMousePointer,
	Undo2,
	Waypoints,
	ZoomIn,
	ZoomOut,
} from "lucide-react";
import { useEffect, useRef } from "react";

// The header switcher's labels; the WebGPU option is disabled when unusable.
const BACKEND_LABEL: Record<CanvasBackend, string> = {
	webgl: "WebGL",
	webgpu: "WebGPU",
};

// Layout factories for the header picker — each call yields a fresh instance.
// Module-level so the reference stays stable across renders (keeps `useLayout`'s
// `applyLayout` stable).
const LAYOUTS: Record<string, LayoutFactory> = {
	"d3-force": () =>
		new D3ForceLayoutEngine({
			charge: { strength: -160 },
			link: { distance: 56 },
			collide: { radius: 14 },
			animate: false,
		}),
	"elk-layered": () =>
		new ElkLayout({ algorithm: "layered", direction: "RIGHT" }),
	"elk-stress": () => new ElkLayout({ algorithm: "stress" }),
};
const LAYOUT_LABEL: Record<string, string> = {
	"d3-force": "Force (d3)",
	"elk-layered": "Layered (ELK)",
	"elk-stress": "Stress (ELK)",
};
const LAYOUT_ICON: Record<string, LucideIcon> = {
	"d3-force": Share2,
	"elk-layered": Network,
	"elk-stress": Orbit,
};

// Select-mode key → registered behaviour id. `useSelectMode` enables exactly one
// entry and disables the rest; click maps to an empty id (no drag-select armed).
const SELECT_MODE_IDS = {
	click: "",
	brush: "brush-select",
	lasso: "lasso-select",
};
const SELECT_LABEL: Record<string, string> = {
	click: "Click select",
	brush: "Brush select",
	lasso: "Lasso select",
};
const SELECT_ICONS = {
	click: MousePointer2,
	brush: SquareDashedMousePointer,
	lasso: Lasso,
};
// One-line hints shown under each mode in the header's `RichSelect` picker.
const SELECT_DESC: Record<string, string> = {
	click: "Click nodes to select; shift-click to add",
	brush: "Drag a rectangle to select everything inside",
	lasso: "Draw a freeform loop to select everything inside",
};
// Header select-mode picker rows, derived from the maps above (display order
// follows `SELECT_MODE_IDS`).
const SELECT_MODE_OPTIONS: RichSelectOption[] = Object.keys(
	SELECT_MODE_IDS,
).map((key) => ({
	value: key,
	label: SELECT_LABEL[key],
	description: SELECT_DESC[key],
	icon: SELECT_ICONS[key as keyof typeof SELECT_ICONS],
}));

// Icon per edge routing type, shown on the edge-routing picker.
const EDGE_TYPE_ICONS = {
	straight: Minus,
	orth: CornerDownRight,
	bezier: Spline,
	rounded: Waypoints,
	smooth: Cable,
};

interface ExplorerHeaderToolbarProps {
	magnet?: boolean;
	onToggleMagnet?: () => void;
	/** Show the magnet (hover-highlight-neighbours) toggle. Default true. The
	 *  read-only Modeller reuses this toolbar without it. */
	showMagnet?: boolean;
	/** Show the undo/redo history controls. Default true. Read-only viewers (the
	 *  Modeller's global/published models) have nothing to undo, so they hide it. */
	showHistory?: boolean;
	/** Show the click/brush/lasso select-mode picker. Default true. Read-only
	 *  viewers (the Modeller's static canvas) don't register the drag-select
	 *  behaviours, so they hide it. */
	showSelectMode?: boolean;
	/** Active render backend; the switcher select reflects + sets it. */
	backend: CanvasBackend;
	onBackendChange: (backend: CanvasBackend) => void;
	/** Horizontal in the header; vertical where it floats over the board. */
	orientation?: "horizontal" | "vertical";
}

/**
 * Board toolbar for the app header. Undo / redo read `canvas.history`, so no
 * provider is needed. ExplorerPage only renders this once the engine (and thus
 * the `'graph'` layer) is live. Clipboard ops live in the canvas context menus.
 *
 * Reused by the Modeller's read-only canvas via `showMagnet={false}` +
 * `showHistory={false}` (no neighbour-hover, nothing to undo on a static view).
 */
export function ExplorerHeaderToolbar({
	magnet,
	onToggleMagnet,
	showMagnet = true,
	showHistory = true,
	showSelectMode = true,
	backend,
	onBackendChange,
	orientation,
}: ExplorerHeaderToolbarProps) {
	return (
		<HeaderToolbarItems
			orientation={orientation}
			magnet={magnet}
			onToggleMagnet={onToggleMagnet}
			showMagnet={showMagnet}
			showHistory={showHistory}
			showSelectMode={showSelectMode}
			backend={backend}
			onBackendChange={onBackendChange}
		/>
	);
}

function HeaderToolbarItems({
	magnet,
	onToggleMagnet,
	showMagnet = true,
	showHistory = true,
	showSelectMode = true,
	backend,
	onBackendChange,
	orientation = "horizontal",
}: ExplorerHeaderToolbarProps) {
	// Live engine — the toolbar only renders once it's live, so this is non-null.
	const canvas = useCanvas();

	// Gate the WebGPU switch on whether this browser can select WebGPU at all
	// (`canUseWebGPU` — API present and not WebKit, where PixiJS WebGPU crashes).
	// The engine still downgrades to WebGL at init if the adapter can't initialise.
	const webgpuAvailable = canUseWebGPU();
	const vertical = orientation === "vertical";

	// Selection mode (click / brush / lasso). Single source of truth for the
	// canvas: picking one arms its drag-select behaviour and disables the others.
	// The hook arms `click` on mount.
	const selectMode = useSelectMode(SELECT_MODE_IDS, {
		labels: SELECT_LABEL,
		initial: "click",
	});

	const history = applyIconOverrides(useHistorySection(), {
		undo: Undo2,
		redo: Redo2,
	});
	const { layout, layoutOptions, applyLayout, isRunning } = useLayout(LAYOUTS, {
		labels: LAYOUT_LABEL,
		initial: "d3-force",
		// The registered active layout already positions new data; let the user's
		// picker apply on demand instead of double-running on mount.
		applyInitial: false,
	});

	// Announce a header-picker layout run on the shared message channel: a sticky
	// "Running…" while it runs, then a "ready" that auto-clears after 3s. (Query
	// auto-layouts are announced separately by <AutoLayoutBridge>.)
	const wasRunning = useRef(false);
	useEffect(() => {
		const label = LAYOUT_LABEL[layout] ?? layout;
		if (isRunning && !wasRunning.current)
			canvas.showMessage(`Running ${label} layout…`);
		else if (!isRunning && wasRunning.current)
			canvas.showMessage(`${label} layout ready`, 3000);
		wasRunning.current = isRunning;
	}, [isRunning, layout, canvas]);

	// Announce the magnet toggle on the message channel (skip the initial mount).
	const firstMagnet = useRef(true);
	useEffect(() => {
		if (!showMagnet) return;
		if (firstMagnet.current) {
			firstMagnet.current = false;
			return;
		}
		canvas.showMessage(
			magnet ? "Hover highlights neighbours" : "Hover highlights the node only",
			2500,
		);
	}, [magnet, canvas, showMagnet]);
	const view = applyIconOverrides(useViewSection(), {
		zoomIn: ZoomIn,
		zoomOut: ZoomOut,
		fit: Maximize,
		locked: Lock,
		unlocked: LockOpen,
	});
	// `useStyleEditorSection` no longer takes per-option icons; inject them onto the
	// returned edge-routing `select` item instead (its `icons` map drives the
	// trigger + per-option glyphs).
	const style = useStyleEditorSection({ layerId: "graph" }).map((item) =>
		item.type === "select" ? { ...item, icons: EDGE_TYPE_ICONS } : item,
	);
	const { showGrid, toggleGrid } = useGrid();

	const div = (key: string): ToolbarItem => ({ type: "divider", key });
	const items: ToolbarItem[] = [
		...(showHistory ? [...history, div("d1")] : []),
		...(showSelectMode
			? [
					{
						// Select-mode picker: a `RichSelect` (icon + label + hint per row)
						// whose trigger shows the active mode's icon. Mirrors the header's
						// other pickers; the single `useSelectMode` instance keeps the
						// canvas's drag-select behaviours in sync.
						type: "custom" as const,
						key: "select-mode",
						render: () => (
							<RichSelect
								options={SELECT_MODE_OPTIONS}
								value={selectMode.mode}
								onChange={(v) => selectMode.setMode(v as string)}
								tooltip="Selection mode"
								renderValue={(selected) => {
									const Icon =
										SELECT_ICONS[selectMode.mode as keyof typeof SELECT_ICONS];
									return (
										<span className="flex items-center gap-2">
											<Icon className="size-4" />
											{/* A vertical bar has room for the icon only. */}
											{vertical ? null : (selected[0]?.label ?? "Select")}
										</span>
									);
								}}
							/>
						),
					},
					div("dsel"),
				]
			: []),
		{
			// Layout switcher as an inline icon toggle group: every layout is
			// visible in the header, the active one stays highlighted, and each
			// reads its name from a hover tooltip. Default (not `outline`) variant
			// so the items have no borders — only the active one tints its
			// background.
			type: "custom",
			key: "layout",
			// No `TooltipProvider` here: the shell mounts one for the whole app
			// (`main.tsx`), and a second would be a second delay to keep in step.
			render: () => (
				<ToggleGroup
					type="single"
					size="sm"
					orientation={orientation}
					className={cn(vertical && "flex-col")}
					value={layout}
					// Radix fires `""` when the active item is re-clicked; ignore that
					// so a layout is always selected.
					onValueChange={(v) => v && applyLayout(v)}
				>
					{Object.entries(layoutOptions).map(([value, label]) => {
						const Icon = LAYOUT_ICON[value] ?? Share2;
						// Keep the item itself the (clean) ToggleGroup child so it
						// keeps its `data-state="on"` highlight — wrapping it in
						// `TooltipTrigger asChild` would clobber that with the
						// tooltip's own `data-state`. The trigger lives on an inner
						// span instead.
						return (
							<ToggleGroupItem key={value} value={value} aria-label={label}>
								<Tooltip>
									<TooltipTrigger asChild>
										<span className="flex size-full items-center justify-center">
											<Icon className="size-4" />
										</span>
									</TooltipTrigger>
									<TooltipContent>{label}</TooltipContent>
								</Tooltip>
							</ToggleGroupItem>
						);
					})}
				</ToggleGroup>
			),
		},
		div("d2"),
		{
			type: "button",
			key: "run-layout",
			icon: Play,
			label: "Run layout",
			onClick: () => applyLayout(layout),
			disabled: isRunning,
		},
		{
			type: "button",
			key: "refresh",
			icon: RefreshCw,
			label: "Re-render (re-run layout + repaint)",
			onClick: () => void canvas.refresh(),
		},
		div("d3"),
		...style,
		div("d4"),
		...view,
		div("d5"),
		{
			type: "toggle",
			key: "grid",
			icon: Grid3x3,
			label: "Toggle grid",
			active: showGrid,
			onToggle: toggleGrid,
		},
		div("d7"),
		{
			// Render backend switcher. Flipping it remounts the canvas (ExplorerCanvas
			// keys on `backend`) so PixiJS re-inits with the chosen renderer. WebGPU is
			// the default (auto-falling back to WebGL); WebGL can be pinned explicitly.
			type: "custom",
			key: "renderer",
			render: () => (
				<ToggleGroup
					type="single"
					size="sm"
					variant="outline"
					value={backend}
					// Radix fires `""` when the active item is re-clicked; ignore that so
					// a backend is always selected.
					onValueChange={(v) => v && onBackendChange(v as CanvasBackend)}
				>
					{(Object.keys(BACKEND_LABEL) as CanvasBackend[]).map((b) => {
						const disabled = b === "webgpu" && !webgpuAvailable;
						return (
							<ToggleGroupItem
								key={b}
								value={b}
								disabled={disabled}
								aria-label={BACKEND_LABEL[b]}
								title={
									disabled
										? "WebGPU isn't available on this device"
										: BACKEND_LABEL[b]
								}
							>
								{BACKEND_LABEL[b]}
							</ToggleGroupItem>
						);
					})}
				</ToggleGroup>
			),
		},
		...(showMagnet
			? [
					div("d8"),
					{
						type: "toggle" as const,
						key: "magnet",
						icon: Magnet,
						label: "Highlight neighbours: off",
						activeLabel: "Highlight neighbours: on",
						active: !!magnet,
						onToggle: onToggleMagnet ?? (() => {}),
					},
				]
			: []),
	];

	// The renderer is a setting, not a tool: the floating bar leaves it out.
	const shown = vertical
		? items.filter((i) => i.key !== "renderer" && i.key !== "d7")
		: items;
	return <ToolbarItems items={shown} orientation={orientation} />;
}
