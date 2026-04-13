import { ArrowLeft } from "lucide-react";
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
		<div className="h-full overflow-auto">
			<div className="max-w-lg mx-auto px-10 py-16">
				{/* Back link */}
				<button
					type="button"
					onClick={() => navigate("/graphs")}
					className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors mb-10"
				>
					<ArrowLeft className="w-4 h-4" />
					<span>Back</span>
				</button>

				{/* Header */}
				<div className="mb-8">
					<h1 className="text-2xl font-bold">New Graph Connection</h1>
					<p className="text-muted-foreground mt-1">
						Connect to a graph database to get started
					</p>
				</div>

				<GraphForm
					isSubmitting={mutation.isPending}
					onSubmit={handleSubmit}
					onCancel={() => navigate("/graphs")}
				/>
			</div>
		</div>
	);
}
