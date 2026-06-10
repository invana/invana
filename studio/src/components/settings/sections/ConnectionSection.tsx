import { Badge, Button, Skeleton, TabbedPanel } from "@invana/ui";
import { Boxes, Database, Pencil } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
	useGraphConnectionQuery,
	useGraphQuery,
	usePutGraphConnectionMutation,
} from "../../../hooks/queries/useGraphs";
import { GraphForm } from "../../../pages/graphs/components/GraphForm";
import { graphsApi } from "../../../services/api/graphs";
import {
	CONNECTOR_OPTIONS,
	type GraphConnectionCreate,
	type GraphConnectionRead,
} from "../../../types/graphs";

type HeaderActions = {
	left?: React.ReactNode;
	center?: React.ReactNode;
	right?: React.ReactNode;
};

interface Props {
	username: string;
	graphSlug: string;
	/** Called after a successful save. */
	onSaved?: () => void;
	headerActions?: HeaderActions;
	className?: string;
}

/**
 * Connection settings rendered as a two-tab `TabbedPanel`: **Connection**
 * (read-only details + edit form) and **Capabilities** (the backend's
 * version-resolved property types + features, RFC-022). Rendered directly inside
 * the docked `SettingsPanel` — chrome (expand / close) comes from `headerActions`.
 */
export function ConnectionSection({
	username,
	graphSlug,
	onSaved,
	headerActions,
	className,
}: Props) {
	const { data: graph, isLoading: graphLoading } = useGraphQuery(
		username,
		graphSlug,
	);
	const { data: connection, isLoading: connectionLoading } =
		useGraphConnectionQuery(username, graphSlug);
	const mutation = usePutGraphConnectionMutation();
	// Details are read-only by default; the edit form only appears on request
	// (or when there's no connection yet to attach).
	const [isEditing, setIsEditing] = useState(false);
	const [activeTab, setActiveTab] = useState<"connection" | "capabilities">(
		"connection",
	);

	const isLoading = graphLoading || connectionLoading;
	const inPad = (c: React.ReactNode) => <div className="p-5">{c}</div>;

	const handleSubmit = (values: GraphConnectionCreate) => {
		mutation.mutate(
			{ username, graphSlug, data: values },
			{
				onSuccess: () => {
					toast.success("Connection saved");
					setIsEditing(false);
					onSaved?.();
				},
				onError: (err) => toast.error(err.message),
			},
		);
	};

	const connectionTab = (() => {
		if (isLoading) {
			return (
				<div className="space-y-4">
					<Skeleton className="h-10 w-full" />
					<Skeleton className="h-10 w-full" />
					<Skeleton className="h-10 w-full" />
				</div>
			);
		}
		if (!graph) {
			return <p className="text-muted-foreground">Graph not found.</p>;
		}
		if (!connection || isEditing) {
			return (
				<div className="space-y-6">
					<p className="text-muted-foreground">
						{connection
							? "Update the database connection. Changing the URI or credentials reconnects automatically."
							: "Attach a graph database to make this Graph queryable."}
					</p>
					<GraphForm
						isEdit={!!connection}
						isSubmitting={mutation.isPending}
						submitError={mutation.error}
						initialValues={
							connection
								? {
										uri: connection.uri,
										connector_class: connection.connector_class,
										read_only: connection.read_only,
										server_version: connection.server_version ?? "",
									}
								: undefined
						}
						onSubmit={handleSubmit}
						onCancel={() => (connection ? setIsEditing(false) : onSaved?.())}
						onTest={(values) =>
							graphsApi.testConnection(username, graphSlug, values)
						}
					/>
				</div>
			);
		}
		return (
			<ConnectionDetails
				connection={connection}
				onEdit={() => setIsEditing(true)}
			/>
		);
	})();

	const capabilitiesTab = isLoading ? (
		<div className="space-y-4">
			<Skeleton className="h-10 w-full" />
			<Skeleton className="h-10 w-2/3" />
		</div>
	) : connection ? (
		<CapabilitiesView connection={connection} />
	) : (
		<p className="text-muted-foreground">
			Attach a connection to see its capabilities.
		</p>
	);

	return (
		<TabbedPanel
			className={className ?? "h-full"}
			tabs={[
				{
					value: "connection",
					label: "Connection",
					icon: Database,
					content: inPad(connectionTab),
				},
				{
					value: "capabilities",
					label: "Capabilities",
					icon: Boxes,
					content: inPad(capabilitiesTab),
				},
			]}
			activeTab={activeTab}
			onTabChange={(v) => setActiveTab(v as "connection" | "capabilities")}
			headerActions={headerActions}
		/>
	);
}

function ConnectionDetails({
	connection,
	onEdit,
}: {
	connection: GraphConnectionRead;
	onEdit: () => void;
}) {
	const connectorLabel =
		CONNECTOR_OPTIONS.find((o) => o.value === connection.connector_class)
			?.label ?? connection.connector_class;

	return (
		<div className="space-y-6">
			<div className="flex items-center justify-between gap-3">
				<p className="text-muted-foreground">
					The graph database this Graph is connected to.
				</p>
				<Button variant="outline" size="sm" onClick={onEdit}>
					<Pencil className="w-3.5 h-3.5 mr-1.5" />
					Edit
				</Button>
			</div>

			<dl className="space-y-3">
				<DetailRow label="Connector">{connectorLabel}</DetailRow>
				<DetailRow label="URI">
					<span className="font-mono">{connection.uri}</span>
				</DetailRow>
				<DetailRow label="Access">
					{connection.read_only ? "Read-only" : "Read / write"}
				</DetailRow>
				<DetailRow label="Status">
					<span className="font-mono">{connection.status}</span>
					{connection.latency_ms !== null && (
						<span className="text-muted-foreground">
							{" "}
							· {connection.latency_ms} ms
						</span>
					)}
				</DetailRow>
				<DetailRow label="Database version">
					<span className="font-mono">
						{connection.server_version ?? "unknown"}
					</span>
					{connection.server_version_source && (
						<span className="text-muted-foreground">
							{" "}
							({connection.server_version_source})
						</span>
					)}{" "}
					<CompatibilityBadge status={connection.compatibility_status} />
					{connection.effective_read_only && (
						<Badge variant="outline" className="ml-1.5">
							read-only
						</Badge>
					)}
				</DetailRow>
				{connection.tested_version_range && (
					<DetailRow label="Tested range">
						<span className="text-muted-foreground">
							{connection.tested_version_range}
						</span>
					</DetailRow>
				)}
			</dl>
		</div>
	);
}

function CapabilitiesView({
	connection,
}: {
	connection: GraphConnectionRead;
}) {
	return (
		<div className="space-y-6">
			<p className="text-muted-foreground">
				What the connected database supports at its detected version — drives
				the property types the modeller offers.
			</p>

			<section className="space-y-2">
				<h3 className="font-semibold">Supported property types</h3>
				{connection.supported_property_types.length > 0 ? (
					<ul className="grid grid-cols-2 gap-x-6 gap-y-1">
						{connection.supported_property_types.map((t) => (
							<li key={t} className="font-mono">
								{t}
							</li>
						))}
					</ul>
				) : (
					<p className="text-muted-foreground">
						— not reported (unknown backend or version)
					</p>
				)}
			</section>

			<section className="space-y-2">
				<h3 className="font-semibold">Features</h3>
				{connection.capabilities.length > 0 ? (
					<ul className="grid grid-cols-2 gap-x-6 gap-y-1">
						{connection.capabilities.map((c) => (
							<li key={c} className="font-mono">
								{c}
							</li>
						))}
					</ul>
				) : (
					<p className="text-muted-foreground">— none reported</p>
				)}
			</section>
		</div>
	);
}

function DetailRow({
	label,
	children,
}: {
	label: string;
	children: React.ReactNode;
}) {
	return (
		<div className="flex gap-3">
			<dt className="w-32 shrink-0 text-muted-foreground">{label}</dt>
			<dd className="min-w-0 break-words">{children}</dd>
		</div>
	);
}

function CompatibilityBadge({
	status,
}: {
	status: GraphConnectionRead["compatibility_status"];
}) {
	const variant =
		status === "supported"
			? "secondary"
			: status === "unsupported"
				? "destructive"
				: "outline";
	return <Badge variant={variant}>{status}</Badge>;
}
