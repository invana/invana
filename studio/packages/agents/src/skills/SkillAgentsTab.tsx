/**
 * A skill › **Agents** — the agents it is bound to, and the act that binds it
 * to one more.
 *
 * Binding offers the skill; the agent decides when to apply it. *Applied* is
 * the usage read's own count per agent — the model's claim, never *used*. An
 * agent whose bind would be refused is named in the picker with the engine's
 * dry-run refusal, so the refusal is read before the click, not after.
 */

import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@invana/forms";
import {
	Button,
	EmptyState,
	Spinner,
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@invana/ui";
import { ActButton } from "@invana-studio/shell";
import { asBindRefusal, BindRefusalCard, FormError } from "@invana-studio/ui";
import { Plus } from "lucide-react";
import { useState } from "react";
import { useAgentMutations } from "../agents/queries";
import { useSkillAgentsQuery, useSkillUsageQuery } from "./queries";
import type { SkillPage } from "./useSkillPage";

export function SkillAgentsTab({
	page,
	onOpenAgent,
}: {
	page: SkillPage;
	onOpenAgent: (id: string) => void;
}) {
	const { username, graphSlug, skill } = page;
	const standings = useSkillAgentsQuery(username, graphSlug, skill.id);
	const usage = useSkillUsageQuery(username, graphSlug, skill.id);
	const m = useAgentMutations(username, graphSlug);
	const [pick, setPick] = useState("");

	if (standings.isLoading)
		return (
			<div className="flex justify-center p-6">
				<Spinner />
			</div>
		);
	if (standings.error)
		return (
			<EmptyState
				className="py-8"
				title="The agents did not load"
				description={(standings.error as Error).message}
			/>
		);

	const items = standings.data?.items ?? [];
	const bound = items.filter((a) => a.bound);
	const unbound = items.filter((a) => !a.bound);
	const applied = new Map(
		(usage.data?.by_agent ?? []).map((a) => [a.agent_id, a.applied]),
	);
	const picked = unbound.find((a) => a.agent_id === pick) ?? null;
	const clicked = asBindRefusal(m.bindSkill.error);
	const busy = m.bindSkill.isPending || m.unbindSkill.isPending;
	const refusal = picked?.refusal ?? clicked;

	return (
		<div className="flex flex-col gap-2.5 p-3.5">
			{bound.length === 0 ? (
				<EmptyState
					className="py-6"
					title="Bound to no agent"
					description="Nothing is offered this skill until an agent carries it. Bind it to one below."
				/>
			) : (
				<Table density="compact">
					<TableHeader>
						<TableRow>
							<TableHead className="w-full">Agent</TableHead>
							<TableHead className="whitespace-nowrap">Applied</TableHead>
							<TableHead />
						</TableRow>
					</TableHeader>
					<TableBody>
						{bound.map((a) => (
							<TableRow key={a.agent_id}>
								<TableCell>
									<Button
										size="xs"
										variant="link"
										className="font-medium"
										onClick={() => onOpenAgent(a.agent_id)}
									>
										{a.agent_name}
									</Button>
								</TableCell>
								<TableCell className="font-mono">
									{applied.get(a.agent_id) ?? "—"}
								</TableCell>
								<TableCell>
									<ActButton
										area="build"
										size="xs"
										variant="ghost"
										disabled={busy}
										onClick={() =>
											m.unbindSkill.mutate({
												id: a.agent_id,
												skillId: skill.id,
											})
										}
									>
										Unbind
									</ActButton>
								</TableCell>
							</TableRow>
						))}
					</TableBody>
				</Table>
			)}

			<div className="flex flex-wrap items-center gap-2">
				<Select value={pick} onValueChange={setPick}>
					<SelectTrigger className="w-72" aria-label="Bind to an agent">
						<SelectValue placeholder="Bind to an agent…" />
					</SelectTrigger>
					<SelectContent>
						{unbound.map((a) => (
							<SelectItem key={a.agent_id} value={a.agent_id}>
								{a.agent_name}
								{a.refusal ? " · refused" : ""}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
				<ActButton
					area="build"
					size="sm"
					variant="outline"
					disabled={!picked || !!picked.refusal || busy}
					onClick={() => {
						if (!picked) return;
						m.bindSkill.reset();
						m.bindSkill.mutate(
							{ id: picked.agent_id, skillId: skill.id },
							{ onSuccess: () => setPick("") },
						);
					}}
				>
					<Plus /> Bind
				</ActButton>
				<span className="ms-auto text-sm text-muted-foreground">
					binding offers the skill; the agent decides when to apply it
				</span>
			</div>
			{refusal ? (
				<BindRefusalCard
					refusal={refusal}
					subject={picked?.agent_name ?? "this agent"}
				/>
			) : (
				<FormError
					error={(m.bindSkill.error ?? m.unbindSkill.error) as Error | null}
				/>
			)}
		</div>
	);
}
