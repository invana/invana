import { Skeleton } from "@invana/ui";
import { toast } from "sonner";
import {
	useGraphConnectionQuery,
	useGraphQuery,
	usePutGraphConnectionMutation,
} from "../../../hooks/queries/useGraphs";
import { GraphForm } from "../../../pages/graphs/components/GraphForm";
import { graphsApi } from "../../../services/api/graphs";
import type { GraphConnectionCreate } from "../../../types/graphs";

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
				<div className="pt-6 border-t border-border">
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
				</div>
			)}
		</div>
	);
}
