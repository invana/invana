/**
 * The Graph's ceiling — how many runs at once, and what happens at it.
 *
 * A budget bounds one agent's spend. Nothing bounded the Graph
 * (docs/for-developers/modules/agents/features/concurrency-and-contention.md):
 * ten agents, each inside its own ceiling, are still ten concurrent query loads,
 * ten claims on one provider's rate limit, and ten connections from a pool that
 * has fewer.
 *
 * The *Runs at once* card on Settings. What the ceiling holds back right now is
 * drawn beside it, by the page: contention has to be visible where the number
 * that causes it is set.
 */

import {
	Input,
	Label,
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@invana/forms";
import { Spinner } from "@invana/ui";
import { useGraphQuery, useUpdateGraphMutation } from "@invana-studio/core";
import { ActButton } from "@invana-studio/shell";
import { Check } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

interface Props {
	username: string;
	graphSlug: string;
}

export function ConcurrencyFields({ username, graphSlug }: Props) {
	const { data: graph, isLoading } = useGraphQuery(username, graphSlug);
	const mutation = useUpdateGraphMutation();

	const [ceiling, setCeiling] = useState("4");
	const [policy, setPolicy] = useState<"queue" | "refuse">("queue");

	useEffect(() => {
		if (!graph) return;
		setCeiling(String(graph.max_concurrent_runs ?? 4));
		setPolicy(graph.concurrency_policy ?? "queue");
	}, [graph]);

	if (!graph)
		return isLoading ? (
			<div className="flex items-center gap-2 text-muted-foreground">
				<Spinner />
				Reading this Graph's ceiling…
			</div>
		) : null;

	const dirty =
		Number(ceiling) !== graph.max_concurrent_runs ||
		policy !== graph.concurrency_policy;

	return (
		<div className="flex flex-col gap-3">
			<div className="flex flex-col gap-1.5">
				<Label htmlFor="max_concurrent_runs">At once</Label>
				<div className="flex items-center gap-2">
					<Input
						id="max_concurrent_runs"
						className="w-28"
						type="number"
						min={0}
						max={64}
						value={ceiling}
						onChange={(e: { target: { value: string } }) =>
							setCeiling(e.target.value)
						}
					/>
					<span className="text-muted-foreground">
						runs in this Graph · 0 means no ceiling
					</span>
				</div>
			</div>

			<div className="flex flex-col gap-1.5">
				<Label htmlFor="concurrency_policy">At the ceiling</Label>
				<Select
					value={policy}
					onValueChange={(v: string) => setPolicy(v as "queue" | "refuse")}
				>
					<SelectTrigger id="concurrency_policy">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="queue">queue — wait for a slot</SelectItem>
						<SelectItem value="refuse">refuse — say so immediately</SelectItem>
					</SelectContent>
				</Select>
			</div>

			<p className="text-sm text-muted-foreground">
				A person's question is served before a scheduled run, and a delegated
				child takes a slot like anything else.
			</p>

			<div className="flex justify-end">
				<ActButton
					area="settings"
					size="sm"
					onClick={() =>
						mutation.mutate(
							{
								username,
								graphSlug,
								data: {
									max_concurrent_runs: Number(ceiling),
									concurrency_policy: policy,
								},
							},
							{
								onSuccess: () => toast.success("Ceiling saved"),
								onError: (err) => toast.error(err.message),
							},
						)
					}
					disabled={!dirty || mutation.isPending}
				>
					<Check />
					{mutation.isPending ? "Saving…" : "Save"}
				</ActButton>
			</div>
		</div>
	);
}
