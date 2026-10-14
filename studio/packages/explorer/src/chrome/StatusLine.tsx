/**
 * The Explorer's `footer`: what the board stands on, and how it is drawing.
 *
 *   ● Neo4j 5.26 · connected                                  WebGPU · 60 fps
 *
 * The left reads the Graph's connection record — the database the connector
 * names and the version it detected. The right reads the live engine: the
 * backend the board was mounted with and its median frame rate over the last
 * second, polled once a second so the bar never repaints with the canvas.
 */
import type { GraphCanvas as GraphCanvasEngine } from "@invana/graph";
import { StatusDot } from "@invana/ui";
import type { CanvasBackend } from "@invana-studio/canvases";
import type { GraphConnectionRead } from "@invana-studio/core";
import { useEffect, useState } from "react";

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
