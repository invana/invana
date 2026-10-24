/**
 * A skill's page — `skill:<id>` in `mainSection`, the Skills list beside it
 * ([authoring-a-skill.md](docs/for-developers/modules/skills/features/authoring-a-skill.md)).
 *
 * *As someone writing playbooks, I want one skill in full width — its prose,
 * its flow, who carries it, whether it is applied and what it used to say — so
 * that I can author and judge it without a 420px column cutting each answer
 * into a scroll.*
 *
 * A record header over five tabs, the agent page's shape:
 * `Instructions · Plan · Bindings · Usage · History`. It authors — write,
 * evaluate and publish on Instructions, bind and unbind on Bindings, restore an
 * earlier version on History.
 *
 * | Tab | What it answers |
 * |---|---|
 * | **Instructions** | what the skill says, its draft, and the evals a publish is gated by |
 * | **Plan** | the plan this version drew, what the last publish regenerated, and who picks it up |
 * | **Bindings** | which agents carry it, and which are refused |
 * | **Usage** | offered against applied, per version |
 * | **History** | every version with who, why and what happened after; *Restore* makes a new one |
 *
 * ## Two words that are never the same claim
 *
 * | Badge | What it means | How we know |
 * |---|---|---|
 * | **offered** | this version's prose was in the prompt | a fact the engine wrote when it built the prompt |
 * | **applied** | the model says it followed it | the model's own claim, and nothing more |
 *
 * Nothing here says *used*. There is no way to verify that a model followed
 * prose, so a word implying we did would be a lie told in a badge.
 */

import {
	Badge,
	Button,
	DiffList,
	DiffRow,
	RecordHeader,
	Spinner,
	TabbedPanel,
} from "@invana/ui";
import { ActButton, ReadOnlyNotice } from "@invana-studio/shell";
import {
	asBindRefusal,
	BindRefusalCard,
	DetailStatus,
	PanelSection,
} from "@invana-studio/ui";
import { BarChart3, GitBranch } from "lucide-react";
import { useState } from "react";
import { useAgentMutations } from "../agents/queries";
import { ChangesTable } from "../changes/ChangesTable";
import { useCompareQuery } from "../changes/history";
import { GatedActDialog } from "../evals/GatedActDialog";
import { useEvalMutations } from "../evals/queries";
import {
	useRollbackSkillMutation,
	useSkillAgentsQuery,
	useSkillDiffQuery,
	useSkillDraftQuery,
	useSkillPlaybookQuery,
	useSkillUsageQuery,
} from "./queries";
import { SkillFlowTab } from "./SkillFlowTab";
import { SkillInstructionsTab } from "./SkillInstructionsTab";
import type {
	BindRefusal,
	Skill,
	SkillAgentStanding,
	SkillUsageVersion,
} from "./types";

export type SkillTab = "playbook" | "flow" | "bindings" | "usage" | "versions";

export function SkillDetail({
	username,
	graphSlug,
	skill,
	editing,
	onEditing,
	onOpenAgent,
	onOpenUsageBoard,
}: {
	username: string;
	graphSlug: string;
	skill: Skill;
	editing: boolean;
	onEditing: (editing: boolean) => void;
	onOpenAgent?: (id: string) => void;
	/** `Usage…` — opens `skill_usage:<id>` beside this page. */
	onOpenUsageBoard?: (skillId: string) => void;
}) {
	const [tab, setTab] = useState<SkillTab>("playbook");
	// The **current** version's plan: what a step is offered today (a
	// plan hangs off the version, never off the skill).
	const plan = useSkillPlaybookQuery(
		username,
		graphSlug,
		skill.id,
		skill.is_draft ? null : skill.version,
	);
	// A draft has no published plan, so its Plan tab draws the draft's own.
	// Read only for a draft: `GET …/draft` opens one when none is open.
	const draft = useSkillDraftQuery(username, graphSlug, skill.id, {
		enabled: skill.is_draft,
	});
	const flowPlan = skill.is_draft ? draft.data?.plan : plan.data;
	const flowLoading = skill.is_draft ? draft.isLoading : plan.isLoading;

	return (
		// `h-full`: the page host is not a flex column, so without it the page
		// grows to its content and the header and tabs scroll away with it.
		<div className="flex h-full min-h-0 flex-col">
			<RecordHeader
				variant="page"
				crumbs={[skill.name]}
				chips={
					<>
						<DetailStatus>
							{skill.is_draft ? "draft" : `v${skill.version}`}
						</DetailStatus>
						<DetailStatus>{skill.origin}</DetailStatus>
					</>
				}
				actions={
					onOpenUsageBoard && !skill.is_draft ? (
						<Button
							size="sm"
							variant="ghost"
							onClick={() => onOpenUsageBoard(skill.id)}
						>
							<BarChart3 /> Usage…
						</Button>
					) : null
				}
			/>
			<div className="shrink-0 px-3.5 pt-3.5 empty:hidden">
				<ReadOnlyNotice area="build" noun="skill" />
			</div>

			<TabbedPanel
				className="min-h-0 flex-1 border-0 bg-transparent shadow-none"
				bodyClassName="@container"
				activeTab={tab}
				onTabChange={(v) => setTab(v as SkillTab)}
				tabs={[
					{
						value: "playbook",
						label: "Instructions",
						content: (
							<SkillInstructionsTab
								username={username}
								graphSlug={graphSlug}
								skill={skill}
								plan={plan.data}
								editing={editing}
								onEditing={onEditing}
								onPublished={() => setTab("flow")}
							/>
						),
					},
					{
						value: "flow",
						label: skill.plan ? `Plan · ${skill.plan.step_count}` : "Plan",
						content: (
							<div className="flex h-full min-h-0 flex-col">
								<div className="min-h-0 flex-1">
									<SkillFlowTab plan={flowPlan} loading={flowLoading} />
								</div>
								{!skill.is_draft && skill.version > 1 ? (
									<Regenerated
										username={username}
										graphSlug={graphSlug}
										skill={skill}
									/>
								) : null}
							</div>
						),
					},
					{
						value: "bindings",
						label: "Bindings",
						content: (
							<BindingsTab
								username={username}
								graphSlug={graphSlug}
								skill={skill}
								onOpenAgent={onOpenAgent}
							/>
						),
					},
					{
						value: "usage",
						label: "Usage",
						content: (
							<UsageTab
								username={username}
								graphSlug={graphSlug}
								skill={skill}
								onOpenBoard={onOpenUsageBoard}
							/>
						),
					},
					{
						value: "versions",
						label: "History",
						content: (
							<SkillHistoryTab
								username={username}
								graphSlug={graphSlug}
								skill={skill}
							/>
						),
					},
				]}
			/>
		</div>
	);
}

/**
 * Under the plan: what the publish that made this version regenerated, and
 * which bound agents pick it up. A run in flight keeps the plan it started
 * with, so the agents here take it on their **next** run.
 */
function Regenerated({
	username,
	graphSlug,
	skill,
}: {
	username: string;
	graphSlug: string;
	skill: Skill;
}) {
	const compare = useCompareQuery(
		username,
		graphSlug,
		"skill",
		skill.id,
		String(skill.version),
	);
	const standings = useSkillAgentsQuery(username, graphSlug, skill.id);
	const diff = compare.data?.plan;
	const bound = (standings.data?.items ?? []).filter((a) => a.bound);
	const touched = diff
		? diff.added.length + diff.removed.length + diff.changed.length
		: 0;

	return (
		<div className="max-h-64 shrink-0 overflow-y-auto border-t">
			<PanelSection
				title={`Regenerated — v${skill.version}`}
				hint={diff ? diff.summary : undefined}
			>
				{compare.isLoading ? (
					<Spinner />
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
				title="Who picks it up"
				hint="a run in flight keeps its plan"
			>
				{bound.length === 0 ? (
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

/**
 * The History tab: every version, who published it, why, and what happened
 * after. *Diff* opens the prose changes under a row; *Restore* makes the next
 * version from an earlier one's text, asked with a reason and gated by the
 * skill's evals like a publish.
 */
function SkillHistoryTab({
	username,
	graphSlug,
	skill,
}: {
	username: string;
	graphSlug: string;
	skill: Skill;
}) {
	const rollback = useRollbackSkillMutation(username, graphSlug, skill.id);
	const evals = useEvalMutations(username, graphSlug, "skill", skill.id);
	const [diffOf, setDiffOf] = useState<number | null>(null);
	const [restoring, setRestoring] = useState<number | null>(null);

	return (
		<div className="flex flex-col gap-2.5 p-3.5">
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
									size="sm"
									variant="ghost"
									onClick={() => setDiffOf(diffOf === v ? null : v)}
								>
									<GitBranch /> {diffOf === v ? "Hide" : "Diff"}
								</Button>
							) : null}
							{latest ? null : (
								<ActButton
									area="build"
									size="sm"
									variant="ghost"
									onClick={() => setRestoring(v)}
								>
									Restore v{v}
								</ActButton>
							)}
						</div>
					);
				}}
				detail={(e) =>
					Number(e.version) === diffOf ? (
						<VersionDiff
							username={username}
							graphSlug={graphSlug}
							skillId={skill.id}
							version={diffOf}
						/>
					) : null
				}
			/>
			<GatedActDialog
				open={restoring !== null}
				title={`Restore v${restoring}`}
				description={`Makes v${skill.version + 1} from the text of v${restoring}; nothing is rewritten.`}
				confirm={`Restore v${restoring}`}
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

/** The engine computes the diff, so every surface agrees about what changed. */
function VersionDiff({
	username,
	graphSlug,
	skillId,
	version,
}: {
	username: string;
	graphSlug: string;
	skillId: string;
	version: number;
}) {
	const diff = useSkillDiffQuery(username, graphSlug, skillId, version);
	if (diff.isLoading) return <Spinner />;
	const changed = (diff.data?.fields ?? []).filter((f) => f.changed);
	if (changed.length === 0)
		return (
			<p className="px-1.5 py-1 text-base text-muted-foreground">
				Nothing changed in the prose.
			</p>
		);

	return (
		<div className="space-y-2 rounded-sm bg-muted/40 p-2">
			<p className="text-base text-muted-foreground">
				v{version} against v{diff.data?.against_version}
			</p>
			{changed.map((field) => (
				<div key={field.field}>
					<p className="text-base font-medium">{field.field}</p>
					<pre className="overflow-x-auto whitespace-pre font-mono text-base">
						{field.lines
							.filter((l) => l.startsWith("+") || l.startsWith("-"))
							.map((line) => (
								<div
									key={line}
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

/**
 * **Bound · refused · not bound** — the three sections, now that both halves of
 * the check run ([bindings.md](docs/for-developers/modules/skills/features/bindings.md)).
 *
 * The **envelope** half refuses a skill whose plan names a `step_key` the agent
 * may never call; the **lens** half refuses one whose plan reaches a band the
 * agent's guardrails have shut. Which ran is stated on the card, because a bind
 * is never refused on grounds it did not check
 * ([bindings.md](docs/for-developers/modules/skills/features/bindings.md)).
 *
 * The refusals are the engine's, run as a dry run and read with the bindings —
 * Studio never predicts one. A refusal that arrives from a *click* is still
 * drawn where the click was, and it agrees with the section because both
 * are the same check.
 */
function BindingsTab({
	username,
	graphSlug,
	skill,
	onOpenAgent,
}: {
	username: string;
	graphSlug: string;
	skill: Skill;
	onOpenAgent?: (id: string) => void;
}) {
	const standings = useSkillAgentsQuery(username, graphSlug, skill.id);
	const mutations = useAgentMutations(username, graphSlug);
	const items = standings.data?.items ?? [];
	const busy = mutations.bindSkill.isPending || mutations.unbindSkill.isPending;
	// The refusal belongs against the agent whose bind raised it — a message
	// floating above the list could not say which row it was about.
	const [refusedFor, setRefusedFor] = useState<string | null>(null);
	const clicked = asBindRefusal(mutations.bindSkill.error);

	const bound = items.filter((a) => a.bound);
	const refused = items.filter((a) => !a.bound && a.refusal);
	const notBound = items.filter((a) => !a.bound && !a.refusal);

	const row = (agent: SkillAgentStanding, isBound: boolean) => (
		<div key={agent.agent_id} className="border-b px-3 py-1.5 last:border-b-0">
			<div className="flex items-center gap-2 text-base">
				<button
					type="button"
					onClick={() => onOpenAgent?.(agent.agent_id)}
					className="min-w-0 flex-1 truncate text-left hover:text-primary"
				>
					{agent.agent_name}
				</button>
				<ActButton
					area="build"
					size="sm"
					variant={isBound ? "ghost" : "outline"}
					className="h-6 shrink-0 text-base"
					disabled={busy || (!isBound && !!agent.refusal)}
					onClick={() => {
						if (isBound) {
							mutations.unbindSkill.mutate({
								id: agent.agent_id,
								skillId: skill.id,
							});
							return;
						}
						mutations.bindSkill.reset();
						setRefusedFor(agent.agent_id);
						mutations.bindSkill.mutate({
							id: agent.agent_id,
							skillId: skill.id,
						});
					}}
				>
					{isBound ? "Unbind" : agent.refusal ? "Refused" : "Bind"}
				</ActButton>
			</div>
			{agent.refusal || (clicked && refusedFor === agent.agent_id) ? (
				<BindRefusalCard
					className="mt-1.5"
					refusal={agent.refusal ?? (clicked as BindRefusal)}
					subject={agent.agent_name}
				/>
			) : null}
		</div>
	);

	if (standings.isLoading) return <Spinner />;

	return (
		<div className="pb-3">
			<PanelSection
				title={`Bound (${bound.length})`}
				hint="the next run is offered it; a run in flight has its prompt already"
			>
				{bound.length === 0 ? (
					<p className="text-base text-muted-foreground">
						Nothing is bound, so this skill exists and never reaches a step.
					</p>
				) : (
					<div className="-mx-3">{bound.map((a) => row(a, true))}</div>
				)}
			</PanelSection>

			{refused.length > 0 ? (
				<PanelSection
					title={`Refused (${refused.length})`}
					hint="checked now, so the bind cannot fail inside a run instead"
				>
					<div className="-mx-3">{refused.map((a) => row(a, false))}</div>
				</PanelSection>
			) : null}

			<PanelSection title={`Not bound (${notBound.length})`}>
				{notBound.length === 0 ? (
					<p className="text-base text-muted-foreground">
						Every agent carries it.
					</p>
				) : (
					<div className="-mx-3">{notBound.map((a) => row(a, false))}</div>
				)}
			</PanelSection>
		</div>
	);
}

/** Offered, applied, and the gap — per version, then by agent and by outcome. */
function UsageTab({
	username,
	graphSlug,
	skill,
	onOpenBoard,
}: {
	username: string;
	graphSlug: string;
	skill: Skill;
	onOpenBoard?: (skillId: string) => void;
}) {
	const usage = useSkillUsageQuery(username, graphSlug, skill.id);
	if (usage.isLoading) return <Spinner />;

	const data = usage.data;
	const current =
		data?.versions.find(
			(v) => v.skill_version_id === data.current_version_id,
		) ?? null;

	return (
		<div className="pb-3">
			<PanelSection
				title={
					skill.is_draft
						? "Nothing published yet"
						: `Current version — v${skill.version}`
				}
				hint="offered is a fact; applied is the model's own report, and nothing more"
				action={
					onOpenBoard ? (
						<Button
							variant="ghost"
							size="sm"
							className="h-6 text-base"
							onClick={() => onOpenBoard(skill.id)}
						>
							More
						</Button>
					) : undefined
				}
			>
				{current ? <Tiles row={current} /> : <NoData />}
			</PanelSection>

			<PanelSection title="By version">
				{(data?.versions ?? []).length === 0 ? (
					<NoData />
				) : (
					<div className="space-y-1">
						{data?.versions.map((v) => (
							<div
								key={v.skill_version_id}
								className="flex items-center gap-2 text-base"
							>
								<Badge variant="secondary">v{v.version}</Badge>
								<span className="text-muted-foreground">
									offered {v.offered} · applied {v.applied}
								</span>
								<span className="ml-auto">{gapLabel(v)}</span>
							</div>
						))}
					</div>
				)}
			</PanelSection>

			<PanelSection
				title="By agent"
				hint="which agents apply it, and which never do"
			>
				{(data?.by_agent ?? []).length === 0 ? (
					<NoData />
				) : (
					<div className="space-y-1">
						{data?.by_agent.map((a) => (
							<div
								key={a.agent_id ?? "none"}
								className="flex items-center gap-2 text-base"
							>
								<span className="truncate">
									{a.agent_name ?? "unattributed"}
								</span>
								<span className="ml-auto text-muted-foreground">
									{a.applied}/{a.offered}
								</span>
							</div>
						))}
					</div>
				)}
			</PanelSection>

			<PanelSection
				title="By outcome"
				hint="applied in runs that served, versus runs that did not"
			>
				{(data?.by_outcome ?? []).length === 0 ? (
					<NoData />
				) : (
					<div className="space-y-1">
						{data?.by_outcome.map((o) => (
							<div
								key={o.outcome ?? "unsettled"}
								className="flex items-center gap-2 text-base"
							>
								<span className="truncate">{o.outcome ?? "still running"}</span>
								<span className="ml-auto text-muted-foreground">
									{o.applied}/{o.offered}
								</span>
							</div>
						))}
					</div>
				)}
			</PanelSection>
		</div>
	);
}

function Tiles({ row }: { row: SkillUsageVersion }) {
	return (
		<div className="grid grid-cols-3 gap-2">
			<Tile label="offered" value={row.offered} />
			<Tile label="applied" value={row.applied} />
			<Tile label="the gap" value={row.gap} hint={gapLabel(row)} />
		</div>
	);
}

function Tile({
	label,
	value,
	hint,
}: {
	label: string;
	value: number;
	hint?: string;
}) {
	return (
		<div className="rounded-sm border px-2 py-1.5">
			<div className="text-lg font-medium tabular-nums">{value}</div>
			<div className="text-base text-muted-foreground">{hint ?? label}</div>
		</div>
	);
}

/**
 * Below the engine's floor there is no ratio to state — *offered 3, applied 1*
 * is three runs, not 33%. The engine decides where that line is so every
 * surface draws it in the same place.
 */
function gapLabel(row: SkillUsageVersion): string {
	if (!row.enough_to_read) return "too few to read";
	return `${row.gap} not applied`;
}

function NoData() {
	return (
		<p className="text-base text-muted-foreground">
			No data yet — which is not the same as a gap of zero.
		</p>
	);
}
