import {
	Canvas,
	ClickSelectPlugin,
	DragCanvasPlugin,
	DragElementPlugin,
	GraphDataPlugin,
	type SelectableElement,
	ZoomControlPlugin,
} from "@invana/canvas-core";
import { D3ForceLayoutPlugin } from "@invana/layouts-d3-force";
import { useEffect, useRef, useState } from "react";
import type { QueryResultItem } from "../../../../types/query";

// ── Colour palette — consistent per-label colouring ──────────────────────────

const PALETTE = [
	"#4f9cf9",
	"#a78bfa",
	"#34d399",
	"#fb923c",
	"#f472b6",
	"#facc15",
	"#38bdf8",
	"#f87171",
];

function labelColor(label: string): string {
	let hash = 0;
	for (let i = 0; i < label.length; i++) {
		hash = (hash * 31 + label.charCodeAt(i)) >>> 0;
	}
	return PALETTE[hash % PALETTE.length];
}

// ── Props ─────────────────────────────────────────────────────────────────────

export interface GraphCanvasProps {
	data: QueryResultItem[];
	onSelectionChange: (item: QueryResultItem | null) => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function GraphCanvas({ data, onSelectionChange }: GraphCanvasProps) {
	const containerRef = useRef<HTMLDivElement>(null);
	const canvasRef = useRef<Canvas | null>(null);
	const graphPluginRef = useRef<GraphDataPlugin | null>(null);
	const layoutPluginRef = useRef<D3ForceLayoutPlugin | null>(null);
	const [ready, setReady] = useState(false);

	// ── Initialise canvas once on mount ──────────────────────────────────────
	// biome-ignore lint/correctness/useExhaustiveDependencies: canvas init runs once on mount
	useEffect(() => {
		if (!containerRef.current) return;

		const canvas = new Canvas({ container: containerRef.current });

		canvas.init().then(async () => {
			// Graph data
			const graphPlugin = new GraphDataPlugin({ fitOnRender: true });
			await canvas.registerPlugin(graphPlugin, { key: "graph-data" });

			// Layout
			const layout = new D3ForceLayoutPlugin({ animate: true });
			await canvas.registerPlugin(layout, { key: "layout" });

			// Interaction
			await canvas.registerPlugin(new DragElementPlugin(), {
				key: "drag-element",
			});
			await canvas.registerPlugin(new DragCanvasPlugin(), {
				key: "drag-canvas",
			});
			await canvas.registerPlugin(new ZoomControlPlugin(), {
				key: "zoom-control",
			});
			const clickSelect = new ClickSelectPlugin({ clearOnBackground: true });
			await canvas.registerPlugin(clickSelect, { key: "click-select" });

			// Selection events
			(
				canvas as unknown as {
					on: (e: string, cb: (payload: unknown) => void) => void;
				}
			).on("selectionChanged", (payload) => {
				const p = payload as {
					nodes: SelectableElement[];
					edges: SelectableElement[];
				};
				const element = p.nodes[0] ?? p.edges[0] ?? null;
				if (!element) {
					onSelectionChange(null);
					return;
				}
				const id = (element as { id: string }).id;
				const found =
					(
						graphPlugin as unknown as {
							_data?: {
								nodes?: Array<{ id: string }>;
								edges?: Array<{ id: string }>;
							};
						}
					)._data?.nodes?.find((n) => n.id === id) ??
					(
						graphPlugin as unknown as {
							_data?: {
								nodes?: Array<{ id: string }>;
								edges?: Array<{ id: string }>;
							};
						}
					)._data?.edges?.find((e) => e.id === id);
				// We look up via the original QueryResultItem data store
				void found; // id is used to look-up in parent instead
				onSelectionChange({ id } as QueryResultItem);
			});

			canvasRef.current = canvas;
			graphPluginRef.current = graphPlugin;
			layoutPluginRef.current = layout;
			setReady(true);
		});

		return () => {
			canvasRef.current?.destroy();
			canvasRef.current = null;
			graphPluginRef.current = null;
			layoutPluginRef.current = null;
			setReady(false);
		};
	}, []); // eslint-disable-line react-hooks/exhaustive-deps

	// ── Update canvas data when query results change ──────────────────────────
	useEffect(() => {
		if (!ready || !graphPluginRef.current || data.length === 0) return;

		const animate = data.filter((d) => d.type === "vertex").length <= 200;

		const nodes = data
			.filter((d) => d.type === "vertex")
			.map((d) => ({
				id: d.id,
				label: d.label,
				shape: "circle" as const,
				fill: labelColor(d.label),
			}));

		const edges = data
			.filter((d) => d.type === "edge")
			.map((d) => ({
				id: d.id,
				source: d.source ?? "",
				target: d.target ?? "",
				label: d.label,
				pathType: "bezier" as const,
			}));

		graphPluginRef.current.setData({ nodes, edges });

		// Run layout after data is set
		if (layoutPluginRef.current) {
			layoutPluginRef.current.setOptions?.({ animate });
			void layoutPluginRef.current.start();
		}
	}, [ready, data]);

	return (
		<div className="relative w-full h-full">
			<div ref={containerRef} className="w-full h-full" />
			{data.length === 0 && (
				<div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-muted-foreground pointer-events-none">
					<svg
						xmlns="http://www.w3.org/2000/svg"
						width="40"
						height="40"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						strokeWidth="1"
						strokeLinecap="round"
						strokeLinejoin="round"
						className="opacity-30"
					>
						<title>Graph</title>
						<circle cx="12" cy="5" r="2" />
						<circle cx="5" cy="19" r="2" />
						<circle cx="19" cy="19" r="2" />
						<line x1="12" y1="7" x2="5" y2="17" />
						<line x1="12" y1="7" x2="19" y2="17" />
					</svg>
					<span className="text-xs">Run a query to explore the graph</span>
				</div>
			)}
		</div>
	);
}
