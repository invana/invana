import { Skeleton } from "@invana/ui";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import {
	useGraphQuery,
	useUpdateGraphMutation,
} from "../../hooks/queries/useGraphs";
import type { GraphUpdate } from "../../types/graphs";
import { GraphForm } from "./components/GraphForm";

export function GraphEditPage() {
	const { id } = useParams<{ id: string }>();
	const navigate = useNavigate();
	const { data: graph, isLoading, isError, error } = useGraphQuery(id ?? "");
	const mutation = useUpdateGraphMutation();

	const handleSubmit = (values: GraphUpdate | { name?: string }) => {
		if (!id) return;
		mutation.mutate(
			{ id, data: values as GraphUpdate },
			{
				onSuccess: (updated) => {
					toast.success(`"${updated.name}" updated`);
					navigate("/graphs");
				},
				onError: (err) => {
					toast.error(err.message);
				},
			},
		);
	};

	return (
		<div className="flex flex-col h-full">
			<div className="px-6 py-4 border-b">
				<h1 className="text-lg font-semibold">
					{isLoading ? (
						<Skeleton className="h-5 w-48" />
					) : (
						`Edit "${graph?.name}"`
					)}
				</h1>
				<p className="text-muted-foreground">Update connection settings</p>
			</div>

			<div className="flex-1 overflow-auto px-6 py-6">
				<div className="max-w-xl">
					{isLoading && (
						<div className="space-y-4">
							{["s1", "s2", "s3", "s4", "s5"].map((k) => (
								<Skeleton key={k} className="h-10 w-full" />
							))}
						</div>
					)}

					{isError && (
						<p className="text-destructive">
							{error instanceof Error ? error.message : "Failed to load graph"}
						</p>
					)}

					{!isLoading && !isError && graph && (
						<GraphForm
							isEdit
							initialValues={{
								name: graph.name,
								description: graph.description,
								uri: graph.uri,
								connector_class: graph.connector_class,
								username: "",
								password: "",
								read_only: graph.read_only,
							}}
							isSubmitting={mutation.isPending}
							onSubmit={handleSubmit}
							onCancel={() => navigate("/graphs")}
						/>
					)}
				</div>
			</div>
		</div>
	);
}
