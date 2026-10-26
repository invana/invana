/**
 * The global model as a full-bleed canvas: every published model drawn as a
 * frame of node types, stitches dashed across the frames.
 *
 * | Where | What | From |
 * |---|---|---|
 * | top-left | the horizontal toolbar, then the floating info bar | `GraphControlsToolbar` · `ToolbarItems` |
 * | bottom-left | the minimap, with the zoom bar beside it | `MiniMapLayer` · `GraphControlsToolbar` |
 * | bottom-centre | what the host puts over the canvas — staged and older-version bars | `children` |
 *
 * It is `SchemaBoard`'s drawing — presets, Detail levels, schema cards and hover
 * cards — recomposed from the app root and surface so the chrome floats over the
 * canvas instead of sitting in a header and footer. A click selects one node or
 * one edge and says so through `onSelect`; the host decides what a selection
 * opens.
 */

import type { RenderPreference } from "@invana/canvas-react";
import {
	BackgroundLayer,
	CanvasThemeSync,
	ClickSelectBehaviour,
	CollapseExpandBehaviour,
	DragNodeBehaviour,
	DragPanBehaviour,
	ElkLayout,
	GraphLayer,
	HoverActivateBehaviour,
	HoverElementPreviewBehaviour,
	MiniMapLayer,
	NodeLabelLODBehaviour,
	TextResolutionLODBehaviour,
	ThemeBehaviour,
	WheelZoomBehaviour,
} from "@invana/canvas-react";
import {
	type DetailStructureBuilder,
	type DetailTemplates,
	GraphCanvasAppRoot,
	GraphCanvasAppSurface,
	GraphControlsToolbar,
	renderSchemaNode,
	SCHEMA_BOARD_CONFIG,
	SCHEMA_DETAIL,
	SCHEMA_LAYER,
	SCHEMA_WILDCARD,
	ToolbarItems,
	useDetailTemplates,
} from "@invana/canvas-ui";
import {
	type ClickSelectBehaviour as ClickSelect,
	type GraphCanvas,
	type SchemaCardOptions,
	type SchemaTypeData,
	schemaCardStructure,
} from "@invana/graph";
import { Card } from "@invana/ui";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { renderModelEdge } from "./preview";
import { decorate, useSuccessColor } from "./style";
import type { Detail, ModelCanvasSelection, ModelGraphData } from "./types";

const LAYOUT = "elk";

/** The minimap's width in px; the zoom bar sits beside it. */
const MINIMAP_WIDTH = 200;
const MINIMAP_HEIGHT = 130;

/** One picker in the info bar. */
export interface GlobalModelSelect {
	key: string;
	/** The trigger's label — `Show`, `Lens`. */
	label: string;
	value: string;
	/** Option key to its label. */
	options: Record<string, string>;
	onChange: (value: string) => void;
}

export interface GlobalModelBoardProps {
	data: ModelGraphData;
	/** The info bar's name for the page — `Global model`. */
	title: string;
	/** What the info bar counts, as one line — `13 node · 27 edge types · 13 stitches`. */
	summary?: string;
	/** Pickers shown after the summary; the board adds Detail itself. */
	selects?: GlobalModelSelect[];
	/** The node or edge drawn selected. */
	selected?: ModelCanvasSelection;
	/** A click on one node or edge, or on nothing. */
	onSelect?: (selection: ModelCanvasSelection) => void;
	/** The Detail the canvas opens on. */
	initialDetail?: Detail;
	/** The render backend. Fixed at init, so a change remounts the canvas. */
	backend?: RenderPreference;
	/** Bars over the bottom of the canvas. */
	children?: ReactNode;
}

/** A type's card names its model and counts the stitches on it. */
const schemaCard = (d: SchemaTypeData): SchemaCardOptions => ({
	subtitle: d.frame
		? "{data.frame} · {data.stitchCount} stitches"
		: "{data.stitchCount} stitches",
});

const sameSelection = (a: ModelCanvasSelection, b: ModelCanvasSelection) =>
	a?.kind === b?.kind && a?.id === b?.id;

/** One identity per equal value — a host that rebuilds equal data re-seeds nothing. */
function useStableValue<T>(value: T): T {
	const signature = JSON.stringify(value);
	const ref = useRef({ signature, value });
	if (ref.current.signature !== signature) ref.current = { signature, value };
	return ref.current.value;
}

export function GlobalModelBoard({
	data: dataProp,
	title,
	summary,
	selects = [],
	selected = null,
	onSelect,
	initialDetail = "high",
	backend,
	children,
}: GlobalModelBoardProps) {
	const success = useSuccessColor();
	const built = useMemo(() => decorate(dataProp, success), [dataProp, success]);
	const data = useStableValue(built);
	const [canvas, setCanvas] = useState<GraphCanvas | null>(null);

	const structures = useMemo<Record<string, DetailStructureBuilder>>(
		() => ({
			schema: (name, node) =>
				schemaCardStructure(
					name,
					node.data as unknown as SchemaTypeData,
					schemaCard(node.data as unknown as SchemaTypeData),
				),
		}),
		[],
	);
	const detail = SCHEMA_DETAIL as unknown as DetailTemplates;
	const { level, setLevel, initialConfig } = useDetailTemplates({
		canvas,
		config: SCHEMA_BOARD_CONFIG,
		detail,
		data,
		layout: LAYOUT,
		layerId: SCHEMA_LAYER,
		wildcard: SCHEMA_WILDCARD,
		structures,
		initial: initialDetail,
	});

	const selectRef = useRef(onSelect);
	selectRef.current = onSelect;
	const selectedRef = useRef(selected);
	selectedRef.current = selected;
	useEffect(() => {
		const select = canvas?.behaviours.get<ClickSelect>("click-select");
		if (!select) return;
		return select.events.on("selection:change", (snapshot) => {
			const [node] = snapshot.shapeIds;
			const [edge] = snapshot.connectorIds;
			const next: ModelCanvasSelection =
				snapshot.shapeIds.length + snapshot.connectorIds.length !== 1
					? null
					: node
						? { kind: "node", id: node }
						: { kind: "edge", id: edge as string };
			if (!sameSelection(next, selectedRef.current)) selectRef.current?.(next);
		});
	}, [canvas]);
	// biome-ignore lint/correctness/useExhaustiveDependencies: `data` is trigger-only — a selection named before the drawing exists lands once the drawing does
	useEffect(() => {
		const select = canvas?.behaviours.get<ClickSelect>("click-select");
		if (!select) return;
		if (!selected) select.clearSelection();
		else
			select.select(
				selected.id,
				selected.kind === "node" ? "shape" : "connector",
			);
	}, [canvas, selected, data]);

	return (
		<div className="relative h-full w-full">
			<GraphCanvasAppRoot
				data={data}
				config={initialConfig}
				bundle={false}
				onReady={setCanvas}
				{...(backend !== undefined
					? { preference: backend, instanceKey: backend }
					: {})}
			>
				<GraphCanvasAppSurface>
					<BackgroundLayer id="background" />
					<GraphLayer id={SCHEMA_LAYER} data={data} />
					<ThemeBehaviour id="theme" />
					<CanvasThemeSync source="tokens" />
					<DragPanBehaviour id="pan" />
					<WheelZoomBehaviour id="wheel" />
					<DragNodeBehaviour id="drag-node" targetLayerId={SCHEMA_LAYER} />
					<HoverActivateBehaviour id="hover" targetLayerId={SCHEMA_LAYER} />
					<ClickSelectBehaviour
						id="click-select"
						targetLayerId={SCHEMA_LAYER}
					/>
					<ElkLayout id={LAYOUT} targetLayerId={SCHEMA_LAYER} fitPadding={60} />
					<CollapseExpandBehaviour
						id="collapse-expand"
						targetLayerId={SCHEMA_LAYER}
						enabled
					/>
					<TextResolutionLODBehaviour
						id="label-resolution"
						targetLayerId={SCHEMA_LAYER}
					/>
					<NodeLabelLODBehaviour id="text-lod" targetLayerId={SCHEMA_LAYER} />
					<HoverElementPreviewBehaviour
						targetLayerId={SCHEMA_LAYER}
						renderNode={renderSchemaNode}
						renderEdge={renderModelEdge}
					/>
					<MiniMapLayer
						graphLayerId={SCHEMA_LAYER}
						backgroundLayerId="background"
						position="bottom-left"
						width={MINIMAP_WIDTH}
						height={MINIMAP_HEIGHT}
					/>
				</GraphCanvasAppSurface>

				{/* The toolbars resolve the engine from context, so they mount once it is ready. */}
				{canvas ? (
					<div className="pointer-events-none absolute inset-0 flex flex-col justify-between gap-2 p-2.5">
						<div className="flex flex-col items-start gap-2">
							<Card className="pointer-events-auto w-fit p-1 shadow-md">
								<GraphControlsToolbar
									layerId={SCHEMA_LAYER}
									sections={{
										history: false,
										layout: false,
										style: false,
										edit: false,
										view: false,
									}}
								/>
							</Card>
							<Card className="pointer-events-auto flex w-fit items-center gap-2 px-3 py-1 shadow-md">
								<span className="whitespace-nowrap font-semibold">{title}</span>
								{summary ? (
									<span className="whitespace-nowrap text-sm text-muted-foreground">
										{summary}
									</span>
								) : null}
								<ToolbarItems
									orientation="horizontal"
									items={[
										...selects.map((s) => ({
											type: "select" as const,
											key: s.key,
											label: s.label,
											value: s.value,
											options: s.options,
											onChange: s.onChange,
										})),
										{
											type: "select" as const,
											key: "detail",
											label: "Detail",
											value: level,
											options: detail.options,
											onChange: (v: string) => setLevel(v),
										},
									]}
								/>
							</Card>
						</div>

						<div className="flex items-end gap-2">
							{/* The canvas draws the minimap under this spacer. */}
							<div aria-hidden className="w-[200px] shrink-0" />
							<Card className="pointer-events-auto w-fit p-1 shadow-md">
								<GraphControlsToolbar
									layerId={SCHEMA_LAYER}
									sections={{
										history: false,
										layout: false,
										selectMode: false,
										style: false,
										edit: false,
										grid: false,
									}}
								/>
							</Card>
							<div className="pointer-events-auto mx-auto flex flex-col items-center gap-2">
								{children}
							</div>
						</div>
					</div>
				) : null}
			</GraphCanvasAppRoot>
		</div>
	);
}
