/**
 * A run › **Assets** — every emission, file, branch and Todo the run
 * produced: its kind, the function and agent that produced it, its size and
 * where it is, as the engine words them.
 */

import {
	Badge,
	Card,
	EmptyState,
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@invana/ui";
import { TabReadState } from "../../agents/agentParts";
import { useRunAssetsQuery } from "../queries";

export function AssetsTab({
	username,
	graphSlug,
	runId,
	live,
}: {
	username: string;
	graphSlug: string;
	runId: string;
	live: boolean;
}) {
	const assets = useRunAssetsQuery(username, graphSlug, runId, live);
	if (!assets.data)
		return (
			<TabReadState
				loading={assets.isLoading}
				error={assets.error}
				what="this run's assets"
				onRetry={() => void assets.refetch()}
			/>
		);
	const items = assets.data.items;
	return (
		<div className="p-3">
			{items.length ? (
				<Card className="rounded-none shadow-none">
					<Table bordered={false} density="compact">
						<TableHeader>
							<TableRow>
								<TableHead>Asset</TableHead>
								<TableHead>Kind</TableHead>
								<TableHead>Produced by</TableHead>
								<TableHead>Size</TableHead>
								<TableHead>Where</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{items.map((a) => (
								<TableRow
									key={`${a.kind}:${a.emission_id ?? a.task_id ?? a.step_run_id ?? "run"}:${a.name}`}
								>
									<TableCell className="font-medium">{a.name}</TableCell>
									<TableCell className="whitespace-nowrap">
										<Badge variant="outline" tone="muted" size="xs">
											{a.kind}
										</Badge>
									</TableCell>
									<TableCell className="text-muted-foreground">
										{a.produced_by}
									</TableCell>
									<TableCell className="whitespace-nowrap">
										{a.size_line || "—"}
									</TableCell>
									<TableCell className="text-muted-foreground">
										{a.where}
									</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				</Card>
			) : (
				<EmptyState
					title="Nothing produced yet"
					description="An answer, a file, a branch or a Todo this run makes is listed here."
				/>
			)}
		</div>
	);
}
