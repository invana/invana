import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useCreateGraphMutation } from "../../hooks/queries/useGraphs";
import type { GraphCreate } from "../../types/graphs";
import { GraphForm } from "./components/GraphForm";

export function GraphCreatePage() {
	const navigate = useNavigate();
	const mutation = useCreateGraphMutation();

	const handleSubmit = (values: GraphCreate | { name?: string }) => {
		mutation.mutate(values as GraphCreate, {
			onSuccess: (graph) => {
				toast.success(`"${graph.name}" connection created`);
				navigate("/graphs");
			},
			onError: (err) => {
				toast.error(err.message);
			},
		});
	};

	return (
		<div className="flex flex-col h-full">
			<div className="px-6 py-4 border-b">
				<h1 className="text-lg font-semibold">New Graph Connection</h1>
				<p className="text-sm text-muted-foreground">
					Connect to a graph database to get started
				</p>
			</div>
			<div className="flex-1 overflow-auto px-6 py-6">
				<div className="max-w-xl">
					<GraphForm
						isSubmitting={mutation.isPending}
						onSubmit={handleSubmit}
						onCancel={() => navigate("/graphs")}
					/>
				</div>
			</div>
		</div>
	);
}
