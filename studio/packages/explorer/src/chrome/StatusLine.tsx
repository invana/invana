/**
 * The Explorer's `footer` pieces that are Studio's — one bar, two zones
 * ([4.4](../../../../../docs/for-developers/modules/explore/features/the-console.md)):
 *
 *   ● Neo4j 5.26 · connected  41 nodes · 31 relationships  2 queries │ Graph ready      3 selected  87%  WebGPU · 60 fps
 *
 * Here: the Graph's connection record, and the canvas's counts, which open the
 * console on Data and on Queries. The board's own sections — the message
 * line, the view (thinned · selection · zoom) and the renderer — are
 * canvas-ui's `MessageStatus`, `ViewStatus` and `RendererStatus`.
 */
import { Button, cn, StatusDot } from "@invana/ui";
import type { GraphConnectionRead } from "@invana-studio/core";

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
