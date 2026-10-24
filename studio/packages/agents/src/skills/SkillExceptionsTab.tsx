/**
 * A skill › **Exceptions** — the replans stored on the runs this skill was
 * offered in, over the engine's window, then every exception those runs met:
 * where it happened, how it was handled, where the handling came from
 * (declared · manifest · improvised · runtime), how often and how often the
 * run served after.
 *
 * Every number is the engine's. The table fills once runs record which
 * handler fired; until then it says so.
 */

import {
	Badge,
	EmptyState,
	MetricGrid,
	MetricTile,
	Spinner,
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
	TypographyInlineCode,
} from "@invana/ui";
import { useSkillExceptionsQuery } from "./queries";
import type { SkillPage } from "./useSkillPage";

const SOURCE_TONE: Record<string, "success" | "warning" | "muted"> = {
	declared: "success",
	improvised: "warning",
};

export function SkillExceptionsTab({ page }: { page: SkillPage }) {
	const q = useSkillExceptionsQuery(
		page.username,
		page.graphSlug,
		page.skill.id,
	);

	if (q.isLoading)
		return (
			<div className="flex justify-center p-6">
				<Spinner />
			</div>
		);
	if (q.error || !q.data)
		return (
			<EmptyState
				className="py-8"
				title="Exceptions did not load"
				description={
					q.error instanceof Error
						? q.error.message
						: "The engine did not answer."
				}
			/>
		);
	const x = q.data;
	if (x.runs === 0)
		return (
			<EmptyState
				className="py-8"
				title="Not run yet"
				description={`No run was offered this skill in the last ${x.days} days. Bind it to an agent, or run a test.`}
			/>
		);

	return (
		<div className="flex flex-col gap-2.5 p-3.5">
			<MetricGrid columns={4} joined>
				<MetricTile
					label={`Runs · ${x.days} days`}
					value={x.runs.toLocaleString()}
					caption="offered this skill"
				/>
				<MetricTile
					label="Replanned"
					value={x.replanned.toLocaleString()}
					caption="at least once"
				/>
				<MetricTile
					label="Replans a run, p95"
					value={x.replans_p95 ?? "—"}
					caption={
						x.max_replans != null
							? `limit ${x.max_replans}`
							: "each run's agent sets the limit"
					}
				/>
				<MetricTile
					label="Hit the limit"
					value={x.hit_limit.toLocaleString()}
					caption="reached their agent's limit"
					captionTone={x.hit_limit > 0 ? "warning" : undefined}
				/>
			</MetricGrid>

			{x.items.length === 0 ? (
				<EmptyState
					className="py-6"
					title="No exceptions recorded yet"
					description="The table fills once runs record which handler caught what."
				/>
			) : (
				<Table density="compact">
					<TableHeader>
						<TableRow>
							<TableHead>Exception</TableHead>
							<TableHead>At</TableHead>
							<TableHead className="w-full">Handled by</TableHead>
							<TableHead>Source</TableHead>
							<TableHead>Seen</TableHead>
							<TableHead className="whitespace-nowrap">Served after</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{x.items.map((r) => (
							<TableRow key={`${r.exception}:${r.function ?? ""}:${r.source}`}>
								<TableCell className="whitespace-nowrap">
									{r.exception}
								</TableCell>
								<TableCell className="whitespace-nowrap">
									{r.function ? (
										<TypographyInlineCode>{r.function}</TypographyInlineCode>
									) : (
										"—"
									)}
								</TableCell>
								<TableCell>{r.handled_by ?? "—"}</TableCell>
								<TableCell>
									<Badge
										size="xs"
										variant="outline"
										tone={SOURCE_TONE[r.source] ?? "muted"}
									>
										{r.source}
									</Badge>
								</TableCell>
								<TableCell className="font-mono">{r.seen}</TableCell>
								<TableCell className="font-mono">
									{r.served_rate == null
										? "—"
										: `${Math.round(r.served_rate * 100)}%`}
								</TableCell>
							</TableRow>
						))}
					</TableBody>
				</Table>
			)}
		</div>
	);
}
