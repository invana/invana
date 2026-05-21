import { Button, Skeleton, Textarea } from "@invana/ui";
import { ArrowLeft } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import {
	useGraphQuery,
	useUpdateGraphMutation,
} from "../../../hooks/queries/useGraphs";

export function GraphIntentSettingsPage() {
	const { username, slug } = useParams<{ username: string; slug: string }>();
	const navigate = useNavigate();
	const { data: graph, isLoading } = useGraphQuery(username, slug);
	const mutation = useUpdateGraphMutation();

	const [intent, setIntent] = useState("");
	useEffect(() => {
		if (graph) setIntent(graph.intent ?? "");
	}, [graph]);

	const backToOverview = () => navigate(`/u/${username}/${slug}`);

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		if (!username || !slug) return;
		mutation.mutate(
			{
				username,
				slug,
				data: { intent: intent.trim() || null },
			},
			{
				onSuccess: () => {
					toast.success("Intent saved");
					backToOverview();
				},
				onError: (err) => toast.error(err.message),
			},
		);
	};

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
					<h1 className="text-2xl font-bold mt-1">Intent</h1>
					<p className="text-muted-foreground mt-1">
						A short statement of what this graph is for and what questions it
						should answer. Used to ground agents and prompts.
					</p>
				</div>

				{isLoading && <Skeleton className="h-32 w-full" />}

				{!isLoading && graph && (
					<form onSubmit={handleSubmit} className="space-y-4">
						<Textarea
							value={intent}
							onChange={(e) => setIntent(e.target.value)}
							rows={8}
							maxLength={10000}
							placeholder="Describe the purpose of this graph…"
						/>
						<div className="flex gap-2">
							<Button type="submit" disabled={mutation.isPending}>
								{mutation.isPending ? "Saving…" : "Save Intent"}
							</Button>
							<Button type="button" variant="outline" onClick={backToOverview}>
								Cancel
							</Button>
						</div>
					</form>
				)}
			</div>
		</div>
	);
}
