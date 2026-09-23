/**
 * A skill, drilled into — the drawer's body, not a page
 * ([SK17](docs/for-developers/modules/skills/features/authoring-a-skill.md)).
 *
 * The drawer's **own header** becomes `‹ SKILLS / Escalate a late supplier` —
 * it is the stack section's title, not a second bar inside the body — and four
 * tabs carry the whole feature: `Playbook · Flow · Bindings · Usage`. The Rules
 * drawer keeps its place underneath, which is what makes this a stack rather
 * than a page (G33).
 *
 * ## Two words that are never the same claim
 *
 * | Badge | What it means | How we know |
 * |---|---|---|
 * | **offered** | this version's prose was in the prompt | a fact the engine wrote when it built the prompt |
 * | **applied** | the model says it followed it | the model's own claim, and nothing more |
 *
 * Nothing here says *used*. There is no way to verify that a model followed
 * prose, so a word implying we did would be a lie told in a badge (US4).
 */

import {
	useSkillAgentsQuery,
	useSkillDiffQuery,
	useSkillPlanQuery,
	useSkillUsageQuery,
	useSkillVersionsQuery,
} from "@/hooks/queries/useSkills";
import { useAgentMutations } from "@/hooks/queries/useWork";
import { SkillFlowTab } from "@/pages/graphs-detail/features/skills/SkillFlowTab";
import { SkillPlaybookTab } from "@/pages/graphs-detail/features/skills/SkillPlaybookTab";
import type {
	BindRefusal,
	Skill,
	SkillAgentStanding,
	SkillUsageVersion,
} from "@/types/skills";
import { BindRefusalCard, asBindRefusal } from "@/ui/BindRefusalCard";
import { PanelSection } from "@/ui/PanelSection";
import {
	Badge,
	Button,
	Spinner,
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
} from "@invana/ui";
import { GitBranch } from "lucide-react";
import { useState } from "react";

type SkillTab = "playbook" | "flow" | "bindings" | "usage";

export function SkillDetail({
	username,
	graphSlug,
	skill,
	editing,
	onEditing,
	onOpenAgent,
	onOpenUsageDashboard,
}: {
	username: string;
	graphSlug: string;
	skill: Skill;
	editing: boolean;
	onEditing: (editing: boolean) => void;
	onOpenAgent?: (id: string) => void;
	/** `More` on the Usage tab — opens `skill_usage:<id>` beside the stack. */
	onOpenUsageDashboard?: (skillId: string) => void;
}) {
	const [tab, setTab] = useState<SkillTab>("playbook");
	// The **current** version's plan: what a step is offered today. A draft's
	// own drawing is read inside the Playbook tab, beside the prose it came
	// from (SK5 — a plan hangs off the version, never off the skill).
	const plan = useSkillPlanQuery(
		username,
		graphSlug,
		skill.id,
		skill.is_draft ? null : skill.version,
	);

	return (
		<div className="flex h-full min-h-0 flex-col">
			<Tabs
				value={tab}
				onValueChange={(v) => setTab(v as SkillTab)}
				className="flex min-h-0 flex-1 flex-col"
			>
				<TabsList className="w-full justify-start gap-1 px-3">
					<TabsTrigger value="playbook">Playbook</TabsTrigger>
					<TabsTrigger value="flow">
						Flow
						{skill.plan ? (
							<Badge variant="secondary" className="ml-1">
								{skill.plan.step_count}
							</Badge>
						) : null}
					</TabsTrigger>
					<TabsTrigger value="bindings">Bindings</TabsTrigger>
					<TabsTrigger value="usage">Usage</TabsTrigger>
				</TabsList>

				<div className="min-h-0 flex-1 overflow-y-auto">
					<TabsContent value="playbook">
						<SkillPlaybookTab
							username={username}
							graphSlug={graphSlug}
							skill={skill}
							plan={plan.data}
							editing={editing}
							onEditing={onEditing}
						/>
						<VersionsSection
							username={username}
							graphSlug={graphSlug}
							skill={skill}
						/>
					</TabsContent>
					<TabsContent value="flow">
						<SkillFlowTab plan={plan.data} loading={plan.isLoading} />
					</TabsContent>
					<TabsContent value="bindings">
						<BindingsTab
							username={username}
							graphSlug={graphSlug}
							skill={skill}
							onOpenAgent={onOpenAgent}
						/>
					</TabsContent>
					<TabsContent value="usage">
						<UsageTab
							username={username}
							graphSlug={graphSlug}
							skill={skill}
							onOpenDashboard={onOpenUsageDashboard}
						/>
					</TabsContent>
				</div>
			</Tabs>
		</div>
	);
}

/**
 * The versions this playbook has been through, reached from the Playbook tab's
 * foot. A published version is immutable, so this is a history rather than a
 * list of things to edit — the one editable row is the draft, and it is above.
 */
function VersionsSection({
	username,
	graphSlug,
	skill,
}: {
	username: string;
	graphSlug: string;
	skill: Skill;
}) {
	const versions = useSkillVersionsQuery(username, graphSlug, skill.id);
	const [diffOf, setDiffOf] = useState<number | null>(null);
	const items = versions.data?.items ?? [];

	if (items.length === 0) return null;

	return (
		<PanelSection
			title="Versions"
			hint="a published version is immutable; a step resolves to the one it read"
		>
			{versions.isLoading ? (
				<Spinner />
			) : (
				<div className="space-y-1">
					{items.map((v) => (
						<div
							key={v.id}
							className="flex items-center gap-2 rounded-sm px-1.5 py-1 text-base hover:bg-muted/50"
						>
							<Badge
								variant={
									v.id === skill.current_version_id ? "default" : "secondary"
								}
							>
								v{v.version}
							</Badge>
							<span className="truncate text-muted-foreground">
								{v.published_at
									? new Date(v.published_at).toLocaleDateString()
									: "draft"}
							</span>
							{v.version > 1 ? (
								<button
									type="button"
									onClick={() =>
										setDiffOf(diffOf === v.version ? null : v.version)
									}
									className="ml-auto flex items-center gap-1 text-muted-foreground hover:text-foreground"
								>
									<GitBranch className="size-3" />
									{diffOf === v.version ? "hide" : "diff"}
								</button>
							) : (
								// v1 is compared against nothing — a first version did not
								// delete anything.
								<span className="ml-auto text-muted-foreground">first</span>
							)}
						</div>
					))}
					{diffOf !== null ? (
						<VersionDiff
							username={username}
							graphSlug={graphSlug}
							skillId={skill.id}
							version={diffOf}
						/>
					) : null}
				</div>
			)}
		</PanelSection>
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
 * the check run ([BN10](docs/for-developers/modules/skills/features/bindings.md)).
 *
 * The **envelope** half refuses a skill whose plan names a `step_key` the agent
 * may never call; the **lens** half refuses one whose plan reaches a band the
 * agent's guardrails have shut. Which ran is stated on the card, because a bind
 * is never refused on grounds it did not check
 * ([BN7](docs/for-developers/modules/skills/features/bindings.md)).
 *
 * The refusals are the engine's, run as a dry run and read with the bindings —
 * Studio never predicts one. A refusal that arrives from a *click* is still
 * drawn where the click was (BN8), and it agrees with the section because both
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
	// floating above the list could not say which row it was about (BN8).
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
					{/* The world the agent carries — which changes *which model
					    decides*, so the row says it rather than asking the reader
					    to hold the mapping. Context beside the refusal, never
					    inside one (BN12). */}
					{agent.world ? (
						<span className="ml-1.5 text-muted-foreground">{agent.world}</span>
					) : null}
				</button>
				<Button
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
				</Button>
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
	onOpenDashboard,
}: {
	username: string;
	graphSlug: string;
	skill: Skill;
	onOpenDashboard?: (skillId: string) => void;
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
					onOpenDashboard ? (
						<Button
							variant="ghost"
							size="sm"
							className="h-6 text-base"
							onClick={() => onOpenDashboard(skill.id)}
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
 * is three runs, not 33% (US6). The engine decides where that line is so every
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
