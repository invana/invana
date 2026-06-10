import { Textarea } from "@invana/forms";
import { Button, Skeleton } from "@invana/ui";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
	useGraphQuery,
	useUpdateGraphMutation,
} from "../../../hooks/queries/useGraphs";
import { FormError } from "../../forms/FormError";

interface Props {
	username: string;
	graphSlug: string;
	onSaved?: () => void;
}

export function IntentSection({ username, graphSlug, onSaved }: Props) {
	const { data: graph, isLoading } = useGraphQuery(username, graphSlug);
	const mutation = useUpdateGraphMutation();
	const [intent, setIntent] = useState("");

	useEffect(() => {
		if (graph) setIntent(graph.intent ?? "");
	}, [graph]);

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		mutation.mutate(
			{
				username,
				graphSlug,
				data: { intent: intent.trim() || null },
			},
			{
				onSuccess: () => {
					toast.success("Intent saved");
					onSaved?.();
				},
				onError: (err) => toast.error(err.message),
			},
		);
	};

	if (isLoading) return <Skeleton className="h-32 w-full" />;
	if (!graph) return <p className="text-muted-foreground">Graph not found.</p>;

	return (
		<form onSubmit={handleSubmit} className="space-y-4">
			<p className="text-muted-foreground">
				A short statement of what this graph is for and what questions it should
				answer. Used to ground agents and prompts.
			</p>
			<Textarea
				value={intent}
				onChange={(e) => setIntent(e.target.value)}
				rows={8}
				maxLength={10000}
				placeholder="Describe the purpose of this graph…"
			/>
			<FormError error={mutation.error} />
			<div className="flex gap-2">
				<Button type="submit" disabled={mutation.isPending}>
					{mutation.isPending ? "Saving…" : "Save Intent"}
				</Button>
			</div>
		</form>
	);
}
