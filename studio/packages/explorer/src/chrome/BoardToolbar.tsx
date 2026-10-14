/**
 * The tools that float over the Explorer's board.
 *
 * - **`BoardToolbar`**, top-left: select · lasso · box, always. With *Tools*
 *   on it grows to the full set — expand the selection, layers, history ·
 *   run the layout, styling, the legend · undo, redo · export an image. Off,
 *   its last control turns the tools on, so the bar is never a dead end.
 * - **`ZoomControls`**, bottom-right: zoom in, zoom out, fit — never hidden,
 *   because a board you cannot frame is a board you cannot read.
 *
 * Both read the live engine through the lifted `CanvasContext`, so they
 * render only once the canvas has published it.
 */
import {
	useCanvas,
	useHistorySection,
	useSelectMode,
	useViewSection,
} from "@invana/canvas-react";
import {
	applyIconOverrides,
	ExportImageToolbar,
	type ToolbarItem,
	ToolbarItems,
} from "@invana/canvas-ui";
import { Card } from "@invana/ui";
import {
	ChevronDown,
	History,
	Lasso,
	Layers,
	ListFilter,
	Maximize,
	MousePointer2,
	Network,
	Palette,
	Redo2,
	Share2,
	SquareDashedMousePointer,
	Undo2,
	ZoomIn,
	ZoomOut,
} from "lucide-react";
import { ACTIVE_LAYOUT_ID } from "../ExplorerCanvas";
import { useExplorerTools } from "./useExplorerTools";

/** Select-mode key → registered behaviour id; click arms no drag-select. */
const SELECT_MODE_IDS = {
	click: "",
	lasso: "lasso-select",
	brush: "brush-select",
};
const SELECT_MODES = [
	{ key: "click", label: "Select", icon: MousePointer2 },
	{ key: "lasso", label: "Lasso select", icon: Lasso },
	{ key: "brush", label: "Box select", icon: SquareDashedMousePointer },
] as const;

/** The board's overlays the toolbar opens — one at a time, top-right. */
export type BoardOverlay = "layers" | "styling" | "history";

export interface BoardToolbarProps {
	/** Expand the selected node's neighbours — opens the fine-tune dialog. */
	onExpandSelection: () => void;
	/** Whether a single node is selected, so *Expand* has something to act on. */
	canExpand: boolean;
	overlay: BoardOverlay | null;
	onToggleOverlay: (overlay: BoardOverlay) => void;
	legendShown: boolean;
	onToggleLegend: () => void;
}

export function BoardToolbar({
	onExpandSelection,
	canExpand,
	overlay,
	onToggleOverlay,
	legendShown,
	onToggleLegend,
}: BoardToolbarProps) {
	const [toolsOn, setToolsOn] = useExplorerTools();
	const selectMode = useSelectMode(SELECT_MODE_IDS, { initial: "click" });
	const history = applyIconOverrides(useHistorySection(), {
		undo: Undo2,
		redo: Redo2,
	});
	const canvas = useCanvas();

	const div = (key: string): ToolbarItem => ({ type: "divider", key });
	const modes: ToolbarItem[] = SELECT_MODES.map((m) => ({
		type: "toggle",
		key: `mode-${m.key}`,
		icon: m.icon,
		label: m.label,
		active: selectMode.mode === m.key,
		onToggle: () => selectMode.setMode(m.key),
	}));
	const overlayToggle = (
		key: BoardOverlay,
		label: string,
		icon: typeof Layers,
	): ToolbarItem => ({
		type: "toggle",
		key,
		icon,
		label,
		active: overlay === key,
		onToggle: () => onToggleOverlay(key),
	});

	const items: ToolbarItem[] = toolsOn
		? [
				...modes,
				div("d1"),
				{
					type: "button",
					key: "expand",
					icon: Share2,
					label: "Expand neighbours",
					onClick: onExpandSelection,
					disabled: !canExpand,
				},
				overlayToggle("layers", "Layers", Layers),
				overlayToggle("history", "Canvas history", History),
				div("d2"),
				{
					type: "button",
					key: "layout",
					icon: Network,
					label: "Run layout",
					onClick: () => void canvas.runLayout(ACTIVE_LAYOUT_ID),
				},
				overlayToggle("styling", "Styling", Palette),
				{
					type: "toggle",
					key: "legend",
					icon: ListFilter,
					label: "Legend",
					active: legendShown,
					onToggle: onToggleLegend,
				},
				div("d3"),
				...history,
				div("d4"),
				{
					type: "custom",
					key: "export",
					render: () => (
						<ExportImageToolbar label="Export image" align="start" />
					),
				},
			]
		: [
				...modes,
				div("d1"),
				{
					type: "button",
					key: "more",
					icon: ChevronDown,
					label: "Show the tools",
					onClick: () => setToolsOn(true),
				},
			];

	return (
		<Card className="p-1 shadow-md">
			<ToolbarItems items={items} orientation="vertical" />
		</Card>
	);
}

const ZOOM_KEYS = new Set(["zoom-in", "zoom-out", "fit"]);

/** Zoom in · zoom out · fit, bottom-right of the board. */
export function ZoomControls() {
	const view = applyIconOverrides(useViewSection(), {
		zoomIn: ZoomIn,
		zoomOut: ZoomOut,
		fit: Maximize,
	}).filter((i) => ZOOM_KEYS.has(i.key ?? ""));
	return (
		<Card className="p-1 shadow-md">
			<ToolbarItems items={view} orientation="vertical" />
		</Card>
	);
}
