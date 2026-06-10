import { Badge, Skeleton } from "@invana/ui";
import { toast } from "sonner";
import {
	useGraphConnectionQuery,
	useGraphQuery,
	usePutGraphConnectionMutation,
} from "../../../hooks/queries/useGraphs";
import { GraphForm } from "../../../pages/graphs/components/GraphForm";
import { graphsApi } from "../../../services/api/graphs";
import type {
	GraphConnectionCreate,
	GraphConnectionRead,
} from "../../../types/graphs";

interface Props {
	username: string;
	graphSlug: string;
	/** Called after a successful save. Useful when the caller wants to close
	 *  the panel or navigate away — sections themselves stay in place. */
	onSaved?: () => void;
}

export function ConnectionSection({ username, graphSlug, onSaved }: Props) {
	const { data: graph, isLoading: graphLoading } = useGraphQuery(
		username,
		graphSlug,
	);
	const { data: connection, isLoading: connectionLoading } =
		useGraphConnectionQuery(username, graphSlug);
	const mutation = usePutGraphConnectionMutation();

	const isLoading = graphLoading || connectionLoading;

	const handleSubmit = (values: GraphConnectionCreate) => {
		mutation.mutate(
			{ username, graphSlug, data: values },
			{
				onSuccess: () => {
					toast.success("Connection saved");
					onSaved?.();
				},
				onError: (err) => toast.error(err.message),
			},
		);
	};

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
				onCancel={() => onSaved?.()}
				onTest={(values) =>
					graphsApi.testConnection(username, graphSlug, values)
				}
			/>

			{connection && (
				<div className="space-y-4 pt-6 border-t border-border">
					<p className="text-muted-foreground">
						Status: <span className="font-mono">{connection.status}</span>
						{connection.latency_ms !== null && (
							<>
								{" "}
								· latency{" "}
								<span className="font-mono">{connection.latency_ms} ms</span>
							</>
						)}
					</p>

					{/* Backend capabilities + version compatibility (RFC-022). */}
					<div className="space-y-3 text-sm">
						<div className="flex flex-wrap items-center gap-2">
							<span className="text-muted-foreground">Database version:</span>
							<span className="font-mono">
								{connection.server_version ?? "unknown"}
							</span>
							{connection.server_version_source && (
								<span className="text-xs text-muted-foreground">
									({connection.server_version_source})
								</span>
							)}
							<CompatibilityBadge status={connection.compatibility_status} />
							{connection.effective_read_only && (
								<Badge variant="outline">read-only</Badge>
							)}
						</div>

						{connection.tested_version_range && (
							<p className="text-xs text-muted-foreground">
								Tested range: {connection.tested_version_range}
							</p>
						)}

						<div className="space-y-1.5">
							<span className="text-muted-foreground">
								Supported property types
							</span>
							<div className="flex flex-wrap gap-1.5">
								{connection.supported_property_types.length > 0 ? (
									connection.supported_property_types.map((t) => (
										<Badge key={t} variant="secondary">
											{t}
										</Badge>
									))
								) : (
									<span className="text-xs text-muted-foreground">
										— not reported (unknown backend or version)
									</span>
								)}
							</div>
						</div>

						{connection.capabilities.length > 0 && (
							<div className="space-y-1.5">
								<span className="text-muted-foreground">Features</span>
								<div className="flex flex-wrap gap-1.5">
									{connection.capabilities.map((c) => (
										<Badge key={c} variant="outline">
											{c}
										</Badge>
									))}
								</div>
							</div>
						)}
					</div>
				</div>
			)}
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
