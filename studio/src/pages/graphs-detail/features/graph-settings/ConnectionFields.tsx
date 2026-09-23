/**
 * The Connection group inside the settings form (`Graph · settings` hi-fi).
 *
 * One Graph, one graph database (CD1). Five things this surface has to say out
 * loud, because each is a rule somebody would otherwise discover the hard way:
 *
 * | Rule | How it shows |
 * |---|---|
 * | Test gates Save (CD2) | the form's Save stays disabled until a test passes |
 * | The connector is fixed after the first save (CD3) | the connector field is read-only once set |
 * | A blank credential means *unchanged* (CD4) | said under the password field, not implied |
 * | Status is a fact with a time on it (C7) | `connected · Neo4j 5.26 · 0 labels · read/write` |
 * | Which database on the server (C8/CD8) | a row beside the URI, editable, blank reading as "Connector default" |
 *
 * `Introspect` sits beside `Test connection` because reading what the database
 * holds is the natural next question after proving you can reach it — and what
 * it returns is the **physical mirror**, never the model (introspect-a-database.md ID2).
 */

import {
	useGraphConnectionQuery,
	useGraphQuery,
	usePutGraphConnectionMutation,
} from "@/hooks/queries/useGraphs";
import { GraphForm } from "@/pages/graphs/GraphForm";
import { graphsApi } from "@/services/api/graphs";
import {
	CONNECTOR_OPTIONS,
	type GraphConnectionCreate,
	type GraphConnectionRead,
} from "@/types/graphs";
import { Badge, Button, Skeleton } from "@invana/ui";
import { Pencil, Sparkles } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface Props {
	username: string;
	graphSlug: string;
}

export function ConnectionFields({ username, graphSlug }: Props) {
	const { data: graph, isLoading: graphLoading } = useGraphQuery(
		username,
		graphSlug,
	);
	const { data: connection, isLoading: connectionLoading } =
		useGraphConnectionQuery(username, graphSlug);
	const mutation = usePutGraphConnectionMutation();
	const [isEditing, setIsEditing] = useState(false);
	const [introspecting, setIntrospecting] = useState(false);

	if (graphLoading || connectionLoading) {
		return (
			<div className="space-y-3">
				<Skeleton className="h-9 w-full" />
				<Skeleton className="h-9 w-full" />
			</div>
		);
	}
	if (!graph) return <p className="text-muted-foreground">Graph not found.</p>;

	const introspect = async () => {
		setIntrospecting(true);
		try {
			await graphsApi.introspectConnection(username, graphSlug);
			toast.success(
				"Reading the database — the physical mirror refreshes when it lands.",
			);
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "Introspection failed.");
		} finally {
			setIntrospecting(false);
		}
	};

	if (!connection || isEditing) {
		return (
			<div className="space-y-4">
				<GraphForm
					isEdit={!!connection}
					isSubmitting={mutation.isPending}
					submitError={mutation.error}
					initialValues={
						connection
							? {
									uri: connection.uri,
									connector_class: connection.connector_class,
									database: connection.database ?? "",
									read_only: connection.read_only,
									server_version: connection.server_version ?? "",
								}
							: undefined
					}
					onSubmit={(values: GraphConnectionCreate) =>
						mutation.mutate(
							{ username, graphSlug, data: values },
							{
								onSuccess: () => {
									toast.success("Connection saved");
									setIsEditing(false);
								},
								onError: (err) => toast.error(err.message),
							},
						)
					}
					onCancel={() => setIsEditing(false)}
					onTest={(values) =>
						graphsApi.testConnection(username, graphSlug, values)
					}
				/>
				<p className="text-sm text-muted-foreground">
					One Graph, one graph database. This Graph will answer only from what
					is loaded into it.
				</p>
			</div>
		);
	}

	return (
		<div className="space-y-3">
			<ConnectionStrip connection={connection} />
			<dl className="space-y-2 text-base">
				<Row label="Connector">
					{CONNECTOR_OPTIONS.find((o) => o.value === connection.connector_class)
						?.label ?? connection.connector_class}
				</Row>
				<Row label="URI">
					<span className="font-mono">{connection.uri}</span>
				</Row>
				<Row label="Database">
					{connection.database ? (
						<span className="font-mono">{connection.database}</span>
					) : (
						<span className="text-muted-foreground">Connector default</span>
					)}
				</Row>
				<Row label="Access">
					{connection.read_only ? "Read-only" : "Read / write"}
				</Row>
			</dl>
			<div className="flex items-center gap-2">
				<Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
					<Pencil className="mr-1.5 h-3.5 w-3.5" />
					Edit
				</Button>
				<Button
					variant="outline"
					size="sm"
					onClick={introspect}
					disabled={introspecting}
					title="Read what the database actually holds — the mirror, never the model"
				>
					<Sparkles className="mr-1.5 h-3.5 w-3.5" />
					{introspecting ? "Reading…" : "Introspect"}
				</Button>
			</div>
			<Capabilities connection={connection} />
			<p className="text-sm text-muted-foreground">
				The connector cannot change after the first save — everything modelled
				against it would stop meaning what it means. Credentials are encrypted
				at rest; a blank field on edit means "keep".
			</p>
		</div>
	);
}

/**
 * The status strip, in the order CD7 fixes: connector, server version, labels,
 * read-write. A failure keeps the last successful check's time rather than
 * going silent (C7).
 */
function ConnectionStrip({
	connection,
}: {
	connection: GraphConnectionRead;
}) {
	const connected = connection.status === "ACTIVE";
	return (
		<div className="flex flex-wrap items-center gap-1.5 text-sm">
			<Badge variant={connected ? "default" : "outline"}>
				{connected ? "connected" : connection.status.toLowerCase()}
			</Badge>
			<span className="text-muted-foreground">
				{CONNECTOR_OPTIONS.find((o) => o.value === connection.connector_class)
					?.label ?? connection.connector_class}{" "}
				{connection.server_version ?? "version unknown"}
			</span>
			<span className="text-muted-foreground">
				· {connection.read_only ? "read-only" : "read/write"}
			</span>
			{connection.latency_ms !== null ? (
				<span className="text-muted-foreground">
					· {connection.latency_ms} ms
				</span>
			) : null}
		</div>
	);
}

/**
 * What this server version can actually hold
 * (docs/for-developers/modules/graph-connectors/features/capabilities.md). It lives inside the
 * Connection group rather than beside it: the answer is a property *of this
 * connection*, and it is what decides which property types the model editor will
 * let you author.
 */
function Capabilities({ connection }: { connection: GraphConnectionRead }) {
	const [open, setOpen] = useState(false);
	const types = connection.supported_property_types;
	return (
		<div className="rounded-sm border px-2.5 py-2">
			<button
				type="button"
				onClick={() => setOpen((v) => !v)}
				className="flex w-full items-center gap-2 text-left text-sm"
			>
				<span className="font-medium">Capabilities</span>
				<span className="text-muted-foreground">
					{types.length
						? `${types.length} property types`
						: "not reported — the modeller falls back to its full vocabulary"}
				</span>
				<span className="ml-auto text-muted-foreground">
					{open ? "hide" : "show"}
				</span>
			</button>
			{open ? (
				<div className="mt-2 space-y-2 text-sm">
					<div>
						<p className="mb-1 font-medium">Property types</p>
						{types.length ? (
							<p className="font-mono text-muted-foreground">
								{types.join(" · ")}
							</p>
						) : (
							<p className="text-muted-foreground">
								— not reported (unknown backend or version)
							</p>
						)}
					</div>
					<div>
						<p className="mb-1 font-medium">Features</p>
						{connection.capabilities.length ? (
							<p className="font-mono text-muted-foreground">
								{connection.capabilities.join(" · ")}
							</p>
						) : (
							<p className="text-muted-foreground">— none reported</p>
						)}
					</div>
				</div>
			) : null}
		</div>
	);
}

function Row({
	label,
	children,
}: { label: string; children: React.ReactNode }) {
	return (
		<div className="flex gap-3">
			<dt className="w-28 shrink-0 text-muted-foreground">{label}</dt>
			<dd className="min-w-0 flex-1">{children}</dd>
		</div>
	);
}
