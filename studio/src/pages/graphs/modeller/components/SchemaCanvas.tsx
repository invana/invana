import { Canvas, GraphDataPlugin } from "@invana/canvas-core";
import { D3ForceLayoutPlugin } from "@invana/layouts-d3-force";
import { useEffect, useRef } from "react";
import type {
	EdgeTypeResponse,
	NodeTypeResponse,
} from "../../../../types/schemas";
import type { SelectedItem } from "./DetailPanel";

// Cycling colour palette for node types
const NODE_COLORS = [
	"#6366f1",
	"#f59e0b",
	"#10b981",
	"#3b82f6",
	"#ef4444",
	"#8b5cf6",
	"#ec4899",
	"#14b8a6",
];
const EDGE_COLOR = "#94a3b8";

interface SchemaCanvasProps {
	nodeTypes: NodeTypeResponse[];
	edgeTypes: EdgeTypeResponse[];
	selected: SelectedItem;
	onSelect: (item: SelectedItem) => void;
}

export function SchemaCanvas({
	nodeTypes,
	edgeTypes,
	selected,
	onSelect,
}: SchemaCanvasProps) {
	const containerRef = useRef<HTMLDivElement>(null);
	const canvasRef = useRef<Canvas | null>(null);

	// ── Initialise / re-initialise canvas when schema data changes ──────────
	// biome-ignore lint/correctness/useExhaustiveDependencies: re-init only on schema data changes; onSelect is a stable setter ref
	useEffect(() => {
		const el = containerRef.current;
		if (!el || (nodeTypes.length === 0 && edgeTypes.length === 0)) return;

		let destroyed = false;

		// Map node-type name → id so edge source/target names can be resolved
		const nameToId = new Map(nodeTypes.map((nt) => [nt.name, nt.id]));

		const nodes = nodeTypes.map((nt, i) => ({
			id: nt.id,
			x: 0,
			y: 0,
			shape: "circle" as const,
			size: 16,
			label: nt.name,
			style: {
				fill: NODE_COLORS[i % NODE_COLORS.length],
				stroke: "#1e1e1e",
				strokeWidth: 1.5,
				labelFill: "#ffffff",
				labelFontSize: 11,
			},
		}));

		const edges = edgeTypes.flatMap((et) =>
			et.source_node_types.flatMap((srcName) =>
				et.target_node_types.flatMap((tgtName) => {
					const srcId = nameToId.get(srcName);
					const tgtId = nameToId.get(tgtName);
					if (!srcId || !tgtId) return [];
					return [
						{
							id: `et-${et.id}-${srcId}-${tgtId}`,
							source: srcId,
							target: tgtId,
							label: et.name,
							pathType: "bezier" as const,
							style: {
								stroke: EDGE_COLOR,
								strokeWidth: 1.5,
								strokeAlpha: 0.8,
							},
						},
					];
				}),
			),
		);

		async function init() {
			const canvas = new Canvas({
				container: el,
				width: el.clientWidth || 800,
				height: el.clientHeight || 600,
				backgroundColor: "transparent",
				behavior: "default",
			});

			// Minimal event-bus so behavior:"default" plugin calls canvas.emit/on/off
			const _handlers: Record<string, ((...args: unknown[]) => void)[]> = {};
			(canvas as unknown as Record<string, unknown>).on = (
				event: string,
				cb: (...args: unknown[]) => void,
			) => {
				if (!_handlers[event]) _handlers[event] = [];
				_handlers[event].push(cb);
			};
			(canvas as unknown as Record<string, unknown>).off = (
				event: string,
				cb: (...args: unknown[]) => void,
			) => {
				_handlers[event] = (_handlers[event] ?? []).filter((h) => h !== cb);
			};
			(canvas as unknown as Record<string, unknown>).emit = (
				event: string,
				...args: unknown[]
			) => {
				for (const h of _handlers[event] ?? []) h(...args);
			};

			await canvas.init();
			if (destroyed) {
				canvas.destroy?.();
				return;
			}
			canvasRef.current = canvas;

			const graphPlugin = new GraphDataPlugin({
				data: { nodes, edges },
				fitOnRender: false,
			});
			await canvas.registerPlugin(graphPlugin);

			const layoutPlugin = new D3ForceLayoutPlugin({
				charge: -400,
				linkDistance: 120,
				collisionRadius: 40,
				animate: true,
			});
			await canvas.registerPlugin(layoutPlugin);
			await (layoutPlugin as unknown as { start?: () => void }).start?.();

			// Listen for node selection from the click-select behaviour
			(
				canvas as unknown as {
					on: (evt: string, cb: (p: unknown) => void) => void;
				}
			).on("selectionChanged", (payload: unknown) => {
				const p = payload as { nodes?: unknown[] } | null;
				const node = p?.nodes?.[0];
				if (!node) return;
				const raw = node as Record<string, unknown>;
				const nodeId = String(
					(raw._data as Record<string, unknown>)?.id ??
						(raw.data as Record<string, unknown>)?.id ??
						raw.id ??
						"",
				);
				if (nodeTypes.find((nt) => nt.id === nodeId)) {
					onSelect({ kind: "node-type", id: nodeId });
				}
			});
		}

		init();

		return () => {
			destroyed = true;
			if (canvasRef.current) {
				canvasRef.current.destroy?.();
				canvasRef.current = null;
			}
		};
		// Re-init whenever schema data changes; onSelect is a stable setter ref
	}, [nodeTypes, edgeTypes]);

	// ── Sync selected node highlight ─────────────────────────────────────────
	useEffect(() => {
		if (!canvasRef.current || !selected || selected.kind !== "node-type")
			return;
		const graphPlugin =
			canvasRef.current.getPlugin<GraphDataPlugin>("graph-data");
		if (
			!(graphPlugin as unknown as { renderer?: { getNodes: () => unknown[] } })
				?.renderer
		)
			return;
		const renderer = (
			graphPlugin as unknown as { renderer: { getNodes: () => unknown[] } }
		).renderer;
		for (const n of renderer.getNodes()) {
			const raw = n as {
				id?: string;
				_data?: { id?: string };
				setState?: (key: string, val: boolean) => void;
			};
			const nodeId = raw._data?.id ?? raw.id ?? "";
			raw.setState?.("selected", nodeId === selected.id);
		}
	}, [selected]);

	return (
		<div className="w-full h-full relative bg-background">
			{nodeTypes.length === 0 && edgeTypes.length === 0 && (
				<div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
					No schema loaded — run Introspect to discover your database schema.
				</div>
			)}
			<div
				ref={containerRef}
				className="w-full h-full"
				style={{ background: "transparent" }}
			/>
		</div>
	);
}
