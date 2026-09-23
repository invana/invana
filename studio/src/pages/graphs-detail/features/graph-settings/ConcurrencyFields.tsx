/**
 * The Graph's ceiling — the third group in the settings form.
 *
 * A budget bounds one agent's spend. Nothing bounded the Graph
 * (docs/for-developers/modules/agents/features/concurrency-and-contention.md):
 * ten agents, each inside its own ceiling, are still ten concurrent query loads,
 * ten claims on one provider's rate limit, and ten connections from a pool that
 * has fewer.
 *
 * It sits beside the connection because that is what it is really about — the
 * database and the provider behind it — and because five recurrences firing at
 * 08:00 is a question about this Graph, not about any one agent.
 *
 * The live counts sit under the fields rather than on a dashboard elsewhere:
 * contention has to be visible where the number that causes it is set (C8).
 */

import {
	useGraphQuery,
	useUpdateGraphMutation,
} from "@/hooks/queries/useGraphs";
import { PoolsTable } from "@/pages/graphs-detail/features/agents/PoolsTable";
import { graphsApi } from "@/services/api/graphs";
import {
	Input,
	Label,
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@invana/forms";
import { Button } from "@invana/ui";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";

interface Props {
	username: string;
	graphSlug: string;
}

export function ConcurrencyFields({ username, graphSlug }: Props) {
	const { data: graph } = useGraphQuery(username, graphSlug);
	const mutation = useUpdateGraphMutation();

	const [ceiling, setCeiling] = useState("4");
	const [policy, setPolicy] = useState<"queue" | "refuse">("queue");

	useEffect(() => {
		if (!graph) return;
		setCeiling(String(graph.max_concurrent_runs ?? 4));
		setPolicy(graph.concurrency_policy ?? "queue");
	}, [graph]);

	// What it is holding back right now. Polled while the panel is open, because
	// the queue lives in the runtime and changes without anything else changing.
	const contention = useQuery({
		queryKey: ["contention", username, graphSlug] as const,
		queryFn: () => graphsApi.contention(username, graphSlug),
		refetchInterval: 5_000,
	});

	if (!graph) return null;

	const dirty =
		Number(ceiling) !== graph.max_concurrent_runs ||
		policy !== graph.concurrency_policy;

	return (
		<div className="space-y-3">
			<div className="flex gap-3">
				<div className="w-28">
					<Label>At once</Label>
					<Input
						type="number"
						min={0}
						max={64}
						value={ceiling}
						onChange={(e: { target: { value: string } }) =>
							setCeiling(e.target.value)
						}
					/>
				</div>
				<div className="flex-1">
					<Label>At the ceiling</Label>
					<Select
						value={policy}
						onValueChange={(v: string) => setPolicy(v as "queue" | "refuse")}
					>
						<SelectTrigger>
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="queue">queue — wait for a slot</SelectItem>
							<SelectItem value="refuse">
								refuse — say so immediately
							</SelectItem>
						</SelectContent>
					</Select>
				</div>
			</div>

			<p className="text-sm text-muted-foreground">
				A person's question is served before a scheduled run, and a delegated
				child takes a slot like anything else. `0` means no ceiling.
			</p>

			{contention.data ? (
				<>
					<p className="text-sm">
						<span className="text-muted-foreground">Right now:</span>{" "}
						<span
							className={contention.data.running_count ? "text-primary" : ""}
						>
							{contention.data.running_count} running
						</span>
						{contention.data.queued_count ? (
							<span className="text-warning">
								{" "}
								· {contention.data.queued_count} queued
							</span>
						) : null}
					</p>
					{/* A5 — the pools, busy or quiet, where the ceiling that causes the
					    contention is set (CC8 · C8). The running count alone cannot say
					    a Graph is stalled on `graphdb` with two runs going. */}
					<PoolsTable contention={contention.data} />
				</>
			) : null}

			{dirty ? (
				<Button
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
							{ onError: (err) => toast.error(err.message) },
						)
					}
					disabled={mutation.isPending}
				>
					Save the ceiling
				</Button>
			) : null}
		</div>
	);
}
