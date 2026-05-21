import { Skeleton } from "@invana/ui";
import { ArrowLeft } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import {
	useGraphConnectionQuery,
	useGraphQuery,
	usePutGraphConnectionMutation,
} from "../../../hooks/queries/useGraphs";
import { graphsApi } from "../../../services/api/graphs";
import type { GraphConnectionCreate } from "../../../types/graphs";
import { GraphForm } from "../components/GraphForm";

export function GraphConnectionSettingsPage() {
	const { username, slug } = useParams<{ username: string; slug: string }>();
	const navigate = useNavigate();
	const { data: graph, isLoading: graphLoading } = useGraphQuery(
		username,
		slug,
	);
	const { data: connection, isLoading: connectionLoading } =
		useGraphConnectionQuery(username, slug);
	const mutation = usePutGraphConnectionMutation();

	const isLoading = graphLoading || connectionLoading;

	const handleSubmit = (values: GraphConnectionCreate) => {
		if (!username || !slug) return;
		mutation.mutate(
			{ username, slug, data: values },
			{
				onSuccess: () => {
					toast.success("Connection saved");
					backToOverview();
				},
				onError: (err) => toast.error(err.message),
			},
		);
	};

	const backToOverview = () => navigate(`/u/${username}/${slug}`);

	return (
		<div className="h-full overflow-auto">
			<div className="max-w-2xl mx-auto px-10 py-12">
				<button
					type="button"
					onClick={backToOverview}
					className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors mb-8"
				>
					<ArrowLeft className="w-4 h-4" />
					<span>Back to overview</span>
				</button>

				<div className="mb-8">
					<p className="text-muted-foreground font-mono">
						/u/{username}/{slug} · settings
					</p>
					<h1 className="text-2xl font-bold mt-1">Connection</h1>
					<p className="text-muted-foreground mt-1">
						{connection
							? "Update the database connection. Changing the URI or credentials reconnects automatically."
							: "Attach a graph database to make this Graph queryable."}
					</p>
				</div>

				{isLoading && (
					<div className="space-y-4">
						<Skeleton className="h-10 w-full" />
						<Skeleton className="h-10 w-full" />
						<Skeleton className="h-10 w-full" />
					</div>
				)}

				{!isLoading && graph && (
					<GraphForm
						isEdit={!!connection}
						isSubmitting={mutation.isPending}
						initialValues={
							connection
								? {
										name: connection.name,
										description: connection.description,
										uri: connection.uri,
										connector_class: connection.connector_class,
										read_only: connection.read_only,
									}
								: { name: graph.name }
						}
						onSubmit={handleSubmit}
						onCancel={backToOverview}
						onTest={(values) =>
							graphsApi.testConnection(
								username as string,
								slug as string,
								values,
							)
						}
					/>
				)}

				{connection && (
					<div className="mt-8 pt-6 border-t border-border">
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
		</div>
	);
}
