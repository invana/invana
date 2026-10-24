/**
 * An agent › **Access** (board `agents.agent.access`): what is enforced today.
 *
 * *As a builder, I want to see which functions this agent may call and why
 * one is refused, so that a refusal at run time is never a surprise.*
 *
 * One table: every function its bound skills need and every function its
 * envelope allows. *Effective* is allowed only where a skill needs it and the
 * envelope allows it; *Why not* names which side is missing — the engine's
 * `missing` for a need the envelope lacks, an empty `needed_by` for an
 * allowance no skill uses. Policies, *started by* and *world* join with IAM;
 * *May delegate to* with delegation.
 */

import {
	Badge,
	BoundChip,
	Button,
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@invana/ui";
import { PanelSection } from "@invana-studio/ui";
import { Check, Minus, X } from "lucide-react";
import { TabReadState } from "./agentParts";
import { useAgentSkillsAndCallablesQuery } from "./queries";
import type { Agent } from "./types";

interface AccessRow {
	fn: string;
	bound: string | null;
	needed: boolean;
	allowed: boolean;
}

const Yes = () => <Check aria-label="yes" className="size-3.5 text-success" />;
const No = () => <X aria-label="no" className="size-3.5 text-destructive" />;
const Dash = () => (
	<Minus aria-label="not asked" className="size-3.5 text-muted-foreground" />
);

export function AgentAccessTab({
	username,
	graphSlug,
	agent,
	onOpenEnvelope,
}: {
	username: string;
	graphSlug: string;
	agent: Agent;
	onOpenEnvelope: () => void;
}) {
	const can = useAgentSkillsAndCallablesQuery(username, graphSlug, agent.id);
	if (!can.data)
		return (
			<TabReadState
				loading={can.isLoading}
				error={can.error}
				what="what this agent may call"
				onRetry={() => void can.refetch()}
			/>
		);

	const rows = new Map<string, AccessRow>();
	for (const c of can.data.callables)
		rows.set(c.step_key, {
			fn: c.step_key,
			bound: c.bound,
			needed: c.needed_by.length > 0,
			allowed: true,
		});
	for (const s of can.data.skills) {
		const missing = new Set(s.missing);
		for (const need of s.needs) {
			const row = rows.get(need);
			if (row) row.needed = true;
			else
				rows.set(need, {
					fn: need,
					bound: null,
					needed: true,
					allowed: !missing.has(need),
				});
		}
	}
	const list = [...rows.values()];

	return (
		<div className="flex flex-col gap-2.5 p-3.5">
			<PanelSection
				card
				title="Functions"
				action={
					<Button size="sm" variant="ghost" onClick={onOpenEnvelope}>
						Draw the envelope
					</Button>
				}
			>
				{list.length ? (
					<Table bordered={false} density="compact">
						<TableHeader>
							<TableRow>
								<TableHead>Function</TableHead>
								<TableHead>Bound</TableHead>
								<TableHead>Its skills need</TableHead>
								<TableHead>Its envelope</TableHead>
								<TableHead>Effective</TableHead>
								<TableHead>Why not</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{list.map((r) => {
								const ok = r.needed && r.allowed;
								return (
									<TableRow key={r.fn}>
										<TableCell>
											<Badge
												variant="outline"
												tone="muted"
												size="xs"
												className={`font-mono font-normal${ok ? "" : " line-through"}`}
											>
												{r.fn}
											</Badge>
										</TableCell>
										<TableCell>
											{r.bound ? <BoundChip bound={r.bound} /> : <Dash />}
										</TableCell>
										<TableCell>{r.needed ? <Yes /> : <No />}</TableCell>
										<TableCell>
											{r.allowed ? <Yes /> : r.needed ? <No /> : <Dash />}
										</TableCell>
										<TableCell>
											<Badge
												size="xs"
												variant="soft"
												tone={ok ? "success" : "destructive"}
											>
												{ok ? "allowed" : "refused"}
											</Badge>
										</TableCell>
										<TableCell className="text-muted-foreground">
											{ok
												? null
												: !r.allowed
													? "not in its envelope"
													: "no skill needs it"}
										</TableCell>
									</TableRow>
								);
							})}
						</TableBody>
					</Table>
				) : (
					<p className="text-muted-foreground">
						Its envelope allows nothing, and no skill needs anything yet.
					</p>
				)}
			</PanelSection>
		</div>
	);
}
