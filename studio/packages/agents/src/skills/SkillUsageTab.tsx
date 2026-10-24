/**
 * A skill › **Usage** — offered against applied for the current version, then
 * by agent and by outcome.
 *
 * Offered is a fact the engine wrote when it built the prompt; applied is the
 * model's own claim. Every number is the engine's: below its floor a rate
 * reads *too few to read* rather than a percentage. The gap's runs are not
 * listed — the engine records no reason a skill was offered and not applied.
 */

import {
	Button,
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
} from "@invana/ui";
import { PanelSection } from "@invana-studio/ui";
import { useSkillAgentsQuery, useSkillUsageQuery } from "./queries";
import type { SkillPage } from "./useSkillPage";

const rate = (r: number | null, enough: boolean) =>
	!enough || r == null ? "too few to read" : `${Math.round(r * 100)}%`;

export function SkillUsageTab({
	page,
	onOpenAgent,
}: {
	page: SkillPage;
	onOpenAgent: (id: string) => void;
}) {
	const { username, graphSlug, skill } = page;
	const usage = useSkillUsageQuery(username, graphSlug, skill.id);
	const standings = useSkillAgentsQuery(username, graphSlug, skill.id);

	if (usage.isLoading)
		return (
			<div className="flex justify-center p-6">
				<Spinner />
			</div>
		);
	if (usage.error)
		return (
			<EmptyState
				className="py-8"
				title="Usage did not load"
				description={(usage.error as Error).message}
			/>
		);

	const data = usage.data;
	const current =
		data?.versions.find(
			(v) => v.skill_version_id === data.current_version_id,
		) ?? null;
	const bound = (standings.data?.items ?? []).filter((a) => a.bound).length;

	if (!current || current.offered === 0)
		return (
			<EmptyState
				className="py-8"
				title="Not run yet"
				description={
					skill.is_draft
						? "A draft is offered to no one. Publish it and bind it to an agent, and its usage fills here."
						: "Nothing has been offered this version yet. Bind it to an agent, and its usage fills as that agent runs."
				}
			/>
		);

	return (
		<div className="flex flex-col gap-2.5 p-3.5">
			<MetricGrid columns={4} joined>
				<MetricTile
					label="Offered"
					value={current.offered}
					caption={`v${current.version} · all time`}
				/>
				<MetricTile
					label="Applied"
					value={current.applied}
					caption={rate(current.applied_rate, current.enough_to_read)}
				/>
				<MetricTile
					label="The gap"
					value={current.gap}
					caption="offered, not applied"
					captionTone={current.gap > 0 ? "warning" : undefined}
				/>
				<MetricTile label="Bound to" value={bound} caption="agents" />
			</MetricGrid>

			<div className="grid items-start gap-2.5 @[760px]:grid-cols-2">
				<PanelSection card title="By agent">
					{(data?.by_agent ?? []).length === 0 ? (
						<p className="text-muted-foreground">
							No agent has been offered it.
						</p>
					) : (
						<Table bordered={false} density="compact">
							<TableHeader>
								<TableRow>
									<TableHead className="w-full">Agent</TableHead>
									<TableHead>Offered</TableHead>
									<TableHead>Applied</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{data?.by_agent.map((a) => (
									<TableRow key={a.agent_id ?? "none"}>
										<TableCell>
											{a.agent_id ? (
												<Button
													size="xs"
													variant="link"
													onClick={() => onOpenAgent(a.agent_id as string)}
												>
													{a.agent_name}
												</Button>
											) : (
												"unattributed"
											)}
										</TableCell>
										<TableCell className="font-mono">{a.offered}</TableCell>
										<TableCell className="font-mono">{a.applied}</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					)}
				</PanelSection>
				<PanelSection card title="By outcome">
					{(data?.by_outcome ?? []).length === 0 ? (
						<p className="text-muted-foreground">No run has settled yet.</p>
					) : (
						<Table bordered={false} density="compact">
							<TableHeader>
								<TableRow>
									<TableHead className="w-full">Outcome</TableHead>
									<TableHead>Offered</TableHead>
									<TableHead>Applied</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{data?.by_outcome.map((o) => (
									<TableRow key={o.outcome ?? "running"}>
										<TableCell>
											{(o.outcome ?? "still running").replaceAll("_", " ")}
										</TableCell>
										<TableCell className="font-mono">{o.offered}</TableCell>
										<TableCell className="font-mono">{o.applied}</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					)}
				</PanelSection>
			</div>
		</div>
	);
}
