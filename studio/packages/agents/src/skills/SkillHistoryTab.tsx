/**
 * A skill › **History** — every version, newest first, with who published it,
 * why, and what happened after. *Diff* opens the prose changes under a row;
 * *Roll back* makes the next version from an earlier one's text, asked with a
 * reason and gated by the skill's evals like a publish. Nothing is rewritten.
 *
 * Above the list, on a published skill past its first version, *Regenerated —
 * vN* is what the publish that made the head did to the plan — steps added,
 * removed and changed, from the engine's compare — and *Who picks it up*: the
 * bound agents, each on its next run, since a run in flight keeps its plan.
 */

import { Badge, Button, DiffList, DiffRow, Spinner } from "@invana/ui";
import { ActButton } from "@invana-studio/shell";
import { PanelSection } from "@invana-studio/ui";
import { GitBranch, RotateCcw } from "lucide-react";
import { useState } from "react";
import { ChangesTable } from "../changes/ChangesTable";
import { GatedActDialog } from "../evals/GatedActDialog";
import { useEvalMutations } from "../evals/queries";
import {
	useRollbackSkillMutation,
	useSkillAgentsQuery,
	useSkillDiffQuery,
	useSkillPlanCompareQuery,
} from "./queries";
import type { SkillPage } from "./useSkillPage";

export function SkillHistoryTab({ page }: { page: SkillPage }) {
	const { username, graphSlug, skill } = page;
	const rollback = useRollbackSkillMutation(username, graphSlug, skill.id);
	const evals = useEvalMutations(username, graphSlug, "skill", skill.id);
	const [diffOf, setDiffOf] = useState<number | null>(null);
	const [restoring, setRestoring] = useState<number | null>(null);

	return (
		<div className="flex flex-col gap-2.5 p-3.5">
			{!skill.is_draft && skill.version > 1 ? (
				<Regenerated page={page} />
			) : null}
			<ChangesTable
				username={username}
				graphSlug={graphSlug}
				kind="skill"
				recordId={skill.id}
				act={(e, latest) => {
					const v = Number(e.version);
					return (
						<div className="flex items-center gap-1">
							{v > 1 ? (
								<Button
									size="xs"
									variant="ghost"
									onClick={() => setDiffOf(diffOf === v ? null : v)}
								>
									<GitBranch /> {diffOf === v ? "Hide" : "Diff"}
								</Button>
							) : null}
							{latest ? null : (
								<ActButton
									area="build"
									size="xs"
									variant="ghost"
									onClick={() => setRestoring(v)}
								>
									<RotateCcw /> Roll back to v{v}
								</ActButton>
							)}
						</div>
					);
				}}
				detail={(e) =>
					Number(e.version) === diffOf ? (
						<VersionDiff page={page} version={diffOf} />
					) : null
				}
			/>
			<GatedActDialog
				open={restoring !== null}
				title={`Roll back to v${restoring}`}
				description={`Makes v${skill.version + 1} from the text of v${restoring}; nothing is rewritten.`}
				confirm={`Roll back to v${restoring}`}
				pending={rollback.isPending}
				error={rollback.error}
				onConfirm={(why) =>
					rollback.mutate(
						{ version: restoring as number, why },
						{ onSuccess: () => setRestoring(null) },
					)
				}
				onClose={() => {
					rollback.reset();
					setRestoring(null);
				}}
				onRunEvals={() =>
					evals.open.mutate({
						version: restoring,
						side: "draft",
						trigger: "rollback",
					})
				}
				runningEvals={evals.open.isPending}
			/>
		</div>
	);
}

/** What the head's publish regenerated, and which bound agents take it up. */
function Regenerated({ page }: { page: SkillPage }) {
	const { username, graphSlug, skill } = page;
	const compare = useSkillPlanCompareQuery(
		username,
		graphSlug,
		skill.id,
		skill.version,
	);
	const standings = useSkillAgentsQuery(username, graphSlug, skill.id);
	const diff = compare.data?.plan ?? null;
	const bound = (standings.data?.items ?? []).filter((a) => a.bound);
	const touched = diff
		? diff.added.length + diff.removed.length + diff.changed.length
		: 0;

	return (
		<div className="grid items-start gap-2.5 @[760px]:grid-cols-2">
			<PanelSection
				card
				title={`Regenerated — v${skill.version}`}
				hint={diff?.summary}
			>
				{compare.isLoading ? (
					<Spinner />
				) : compare.error ? (
					<p className="text-muted-foreground">
						{(compare.error as Error).message}
					</p>
				) : !diff || touched === 0 ? (
					<p className="text-muted-foreground">
						The plan did not change with this version.
					</p>
				) : (
					<DiffList>
						{diff.added.map((k) => (
							<DiffRow key={`+${k}`} op="add" kind="step">
								{k}
							</DiffRow>
						))}
						{diff.removed.map((k) => (
							<DiffRow key={`-${k}`} op="remove" kind="step">
								{k}
							</DiffRow>
						))}
						{diff.changed.map((c) => (
							<DiffRow key={`~${c.step_key}`} op="change" kind="step">
								{c.step_key} · {c.fields.join(", ")}
							</DiffRow>
						))}
					</DiffList>
				)}
			</PanelSection>
			<PanelSection
				card
				title="Who picks it up"
				hint="a run in flight keeps its plan"
			>
				{standings.isLoading ? (
					<Spinner />
				) : bound.length === 0 ? (
					<p className="text-muted-foreground">
						No agent carries it, so no run picks it up.
					</p>
				) : (
					<div className="flex flex-wrap gap-1">
						{bound.map((a) => (
							<Badge key={a.agent_id} variant="secondary">
								{a.agent_name} · next run
							</Badge>
						))}
					</div>
				)}
			</PanelSection>
		</div>
	);
}

/** The engine computes the diff, so every surface agrees about what changed. */
function VersionDiff({ page, version }: { page: SkillPage; version: number }) {
	const diff = useSkillDiffQuery(
		page.username,
		page.graphSlug,
		page.skill.id,
		version,
	);
	if (diff.isLoading) return <Spinner />;
	const changed = (diff.data?.fields ?? []).filter((f) => f.changed);
	if (changed.length === 0)
		return (
			<p className="text-muted-foreground">Nothing changed in the prose.</p>
		);

	return (
		<div className="flex flex-col gap-2 bg-muted/40 p-2">
			<p className="text-muted-foreground">
				v{version} against v{diff.data?.against_version}
			</p>
			{changed.map((field) => (
				<div key={field.field}>
					<p className="font-medium">{field.field}</p>
					<pre className="overflow-x-auto whitespace-pre font-mono">
						{field.lines
							.filter((l) => l.startsWith("+") || l.startsWith("-"))
							.map((line, i) => (
								<div
									// Two identical lines can sit in one diff.
									// biome-ignore lint/suspicious/noArrayIndexKey: lines have no id
									key={`${i}:${line}`}
									className={
										line.startsWith("+") ? "text-success" : "text-destructive"
									}
								>
									{line}
								</div>
							))}
					</pre>
				</div>
			))}
		</div>
	);
}
