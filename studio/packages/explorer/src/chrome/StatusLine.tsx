/**
 * The Explorer's `footer` — one bar, two zones
 * ([4.4](../../../../../docs/for-developers/modules/explore/features/the-console.md)):
 *
 *   ● Neo4j 5.26 · connected  41 nodes · 31 relationships  2 queries │ Graph ready      3 selected  87%  WebGPU · 60 fps
 *
 * Left: the Graph's connection record, then — with a canvas in front — its
 * counts, which open the console on Data and on Queries, then the message
 * line: what the pointer is over, else the canvas's latest message (a mode's
 * hint, a layout's progress). It is plain text, last, and truncates before the
 * right zone. Right: whether edges are thinned, the selection, the zoom, and
 * the live engine — the backend
 * the board was mounted with and its median frame rate over the last second,
 * polled once a second so the bar never repaints with the canvas.
 */
import { useCanvasMessage, useSelection, useZoom } from "@invana/canvas-react";
import type {
	GraphCanvas as GraphCanvasEngine,
	GraphLayer,
} from "@invana/graph";
import { Button, cn, StatusDot } from "@invana/ui";
import type { CanvasBackend } from "@invana-studio/canvases";
import type { GraphConnectionRead } from "@invana-studio/core";
import { useEffect, useState } from "react";
import { edgesThinned, THIN_KEEP } from "../edgeDensity";

const BACKEND_LABEL: Record<CanvasBackend, string> = {
	webgl: "WebGL",
	webgpu: "WebGPU",
};

/** `invana_neo4j.connector.Neo4jConnector` → `Neo4j`. */
function databaseName(connectorClass: string): string {
	return (
		connectorClass
			.split(".")
			.pop()
			?.replace(/Connector$/, "") || "Database"
	);
}

export function ConnectionLine({
	connection,
}: {
	/** Undefined while loading; null when the engine is unreachable. */
	connection: GraphConnectionRead | null | undefined;
}) {
	if (connection === undefined) return null;
	if (connection === null)
		return (
			<span className="flex items-center gap-1.5 px-2">
				<StatusDot tone="error" />
				Engine unreachable — reconnecting…
			</span>
		);
	const live = connection.status === "ACTIVE";
	const db = [
		databaseName(connection.connector_class),
		connection.server_version,
	]
		.filter(Boolean)
		.join(" ");
	return (
		<span className="flex items-center gap-1.5 px-2">
			<StatusDot tone={live ? "success" : "error"} />
			{db} · {live ? "connected" : connection.status.toLowerCase()}
		</span>
	);
}

export function RendererLine({
	canvas,
	backend,
}: {
	canvas: GraphCanvasEngine | null;
	backend: CanvasBackend;
}) {
	const [fps, setFps] = useState<number | null>(null);
	useEffect(() => {
		if (!canvas) {
			setFps(null);
			return;
		}
		const read = () => {
			const stats = canvas.frames.stats();
			setFps(stats.count ? Math.round(stats.fps) : null);
		};
		read();
		const timer = window.setInterval(read, 1000);
		return () => window.clearInterval(timer);
	}, [canvas]);
	return (
		<span className="px-2">
			{BACKEND_LABEL[backend]}
			{fps != null && ` · ${fps} fps`}
		</span>
	);
}

/**
 * The canvas's counts, which are the console's toggles: the records open it on
 * Data, the queries on Queries, and the count of the open tab collapses it.
 */
export function ConsoleCounts({
	nodes,
	relationships,
	queries,
	failed,
	open,
	onToggle,
}: {
	nodes: number;
	relationships: number;
	queries: number;
	/** A query this session failed — a dot on the count. */
	failed: boolean;
	open: "data" | "queries" | null;
	onToggle: (tab: "data" | "queries") => void;
}) {
	const count = (tab: "data" | "queries", text: string, dot?: boolean) => (
		<Button
			variant="link"
			size="xs"
			aria-pressed={open === tab}
			className={cn(
				"h-auto px-1 underline decoration-border",
				open === tab ? "font-medium" : "text-foreground",
			)}
			onClick={() => onToggle(tab)}
		>
			{text}
			{dot ? <StatusDot tone="error" label="a query failed" /> : null}
		</Button>
	);
	return (
		<span className="flex shrink-0 items-center gap-2">
			{count(
				"data",
				`${nodes.toLocaleString()} nodes · ${relationships.toLocaleString()} relationships`,
			)}
			{count(
				"queries",
				`${queries} ${queries === 1 ? "query" : "queries"}`,
				failed,
			)}
		</span>
	);
}

/**
 * The message line: what the pointer is over — a node's drawn label and type,
 * a relationship's type — else the canvas's latest message.
 */
export function MessageLine({ canvas }: { canvas: GraphCanvasEngine }) {
	const { message } = useCanvasMessage(canvas);
	const [hover, setHover] = useState<string | null>(null);
	useEffect(() => {
		const layer = canvas.layers.get<GraphLayer>("graph");
		const renderer = layer?.getRenderer();
		const store = layer?.store;
		if (!layer || !renderer || !store) return;
		const onNode = ({ id }: { id: string }) => {
			const node = store.getNode(id);
			const label = node ? layer.resolveNodeStyle(node).labelText : "";
			setHover([node?.type, label || id].filter(Boolean).join(" · "));
		};
		const onEdge = ({ id }: { id: string }) => {
			const edge = store.getEdge(id);
			setHover(edge?.type ?? id);
		};
		const onOut = () => setHover(null);
		renderer.events.on("shape:pointerover", onNode);
		renderer.events.on("shape:pointerout", onOut);
		renderer.events.on("connector:pointerover", onEdge);
		renderer.events.on("connector:pointerout", onOut);
		return () => {
			renderer.events.off("shape:pointerover", onNode);
			renderer.events.off("shape:pointerout", onOut);
			renderer.events.off("connector:pointerover", onEdge);
			renderer.events.off("connector:pointerout", onOut);
		};
	}, [canvas]);
	const text = hover ?? message;
	if (!text) return null;
	return (
		<span
			title={text}
			className="min-w-0 truncate border-l border-border pl-3 text-muted-foreground"
		>
			{text}
		</span>
	);
}

/**
 * The selection and the zoom, live off the engine — and, while a dense result
 * is zoomed out far enough to thin its edges, that only some are drawn, so a
 * missing line is never read as a missing relationship.
 */
export function ViewLine({
	canvas,
	relationships,
}: {
	canvas: GraphCanvasEngine;
	/** Relationships on the canvas — decides whether edges thin. */
	relationships: number;
}) {
	const { zoom } = useZoom(canvas);
	const { count } = useSelection({}, canvas);
	return (
		<span className="flex items-center gap-3 px-2">
			{edgesThinned(relationships, zoom) ? (
				<span className="text-muted-foreground">
					About 1 in {Math.round(1 / THIN_KEEP)} relationships drawn · zoom in
					for all
				</span>
			) : null}
			{count > 0 ? <span>{count} selected</span> : null}
			<span className="tabular-nums">{Math.round(zoom * 100)}%</span>
		</span>
	);
}
