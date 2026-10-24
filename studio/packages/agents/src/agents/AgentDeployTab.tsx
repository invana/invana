/**
 * An agent › **Deploy** (board `agents.agent.deploy`): where its steps run and
 * what starts it.
 *
 * - **Where its steps run** — each resource its functions declare (`resources`
 *   on the function's manifest), the functions that need it, and the Graph's
 *   pool of that name with what is in use now (`GET …/contention`). A resource
 *   with no pool of its name is unbounded, and says so.
 * - **Triggers** — *Can be assigned* and *Unattended* (`policy.can_be_assigned`
 *   · `policy.unattended`), riding the page's one buffer.
 *
 * The functions are the ones its envelope allows. An event trigger and pool
 * labels join with workers; callable over MCP with this Graph's MCP server.
 */

import { Checkbox, Field, FieldLabel } from "@invana/forms";
import {
	Badge,
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@invana/ui";
import { graphsApi } from "@invana-studio/core";
import { useAccess } from "@invana-studio/shell";
import { PanelSection } from "@invana-studio/ui";
import { useQueries, useQuery } from "@tanstack/react-query";
import { pluginsApi } from "../plugins/api";
import type { AgentDraft } from "./agentDraft";
import { TabReadState } from "./agentParts";
import { useAgentSkillsAndCallablesQuery } from "./queries";
import type { Agent } from "./types";

const TRIGGERS: { key: string; label: string }[] = [
	{ key: "can_be_assigned", label: "Can be assigned — a Todo may name it" },
	{
		key: "unattended",
		label: "Unattended — runs with no person to ask; an ask ends the step",
	},
];

export function AgentDeployTab({
	username,
	graphSlug,
	agent,
	draft,
	onPatch,
}: {
	username: string;
	graphSlug: string;
	agent: Agent;
	draft: AgentDraft;
	onPatch: (next: Partial<AgentDraft>) => void;
}) {
	const build = useAccess().gate("build");
	const readOnly = !build.allowed || agent.status === "retired";
	const can = useAgentSkillsAndCallablesQuery(username, graphSlug, agent.id);
	const keys = (can.data?.callables ?? []).map((c) => c.step_key);
	// The same cache entry the function page reads.
	const manifests = useQueries({
		queries: keys.map((ref) => ({
			queryKey: ["plugins", "function", ref],
			queryFn: () => pluginsApi.function(ref),
		})),
	});
	const contention = useQuery({
		queryKey: ["contention", username, graphSlug] as const,
		queryFn: () => graphsApi.contention(username, graphSlug),
	});

	// resource → the functions that declare it, in the envelope's order.
	const byResource = new Map<string, string[]>();
	manifests.forEach((q, i) => {
		for (const r of q.data?.resources ?? [])
			byResource.set(r, [...(byResource.get(r) ?? []), keys[i]]);
	});
	const pools = new Map((contention.data?.pools ?? []).map((p) => [p.pool, p]));
	const loading =
		can.isLoading || contention.isLoading || manifests.some((q) => q.isLoading);

	return (
		<div className="flex flex-col gap-2.5 p-3.5">
			<PanelSection card title="Where its steps run">
				{loading || can.error || contention.error ? (
					<TabReadState
						loading={loading}
						error={can.error ?? contention.error}
						what="where its steps run"
					/>
				) : byResource.size ? (
					<Table bordered={false} density="compact">
						<TableHeader>
							<TableRow>
								<TableHead>Resource</TableHead>
								<TableHead>Its functions</TableHead>
								<TableHead>Pool</TableHead>
								<TableHead>In use now</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{[...byResource].map(([resource, fns]) => {
								const pool = pools.get(resource);
								const full = pool ? pool.in_use >= pool.size : false;
								return (
									<TableRow key={resource}>
										<TableCell>
											<Badge
												variant="outline"
												tone="muted"
												size="xs"
												className="font-mono font-normal"
											>
												{resource}
											</Badge>
										</TableCell>
										<TableCell className="max-w-0 truncate font-mono text-muted-foreground">
											{fns.join(" · ")}
										</TableCell>
										<TableCell className="font-mono">
											{pool ? pool.pool : "no pool — unbounded"}
										</TableCell>
										<TableCell className={full ? "text-warning" : undefined}>
											{pool
												? `${pool.in_use} of ${pool.size}${full ? " · full" : ""}`
												: "—"}
										</TableCell>
									</TableRow>
								);
							})}
						</TableBody>
					</Table>
				) : (
					<p className="text-muted-foreground">
						Its envelope allows no function yet, so no step has anywhere to run.
					</p>
				)}
			</PanelSection>

			<PanelSection card title="Triggers">
				<div className="flex flex-col gap-2">
					{TRIGGERS.map((t) => (
						<Field key={t.key} orientation="horizontal">
							<Checkbox
								id={`trigger-${t.key}`}
								checked={draft.policy[t.key] === true}
								disabled={readOnly}
								onCheckedChange={(on) =>
									onPatch({ policy: { ...draft.policy, [t.key]: on === true } })
								}
							/>
							<FieldLabel htmlFor={`trigger-${t.key}`} className="font-normal">
								{t.label}
							</FieldLabel>
						</Field>
					))}
				</div>
			</PanelSection>
		</div>
	);
}
