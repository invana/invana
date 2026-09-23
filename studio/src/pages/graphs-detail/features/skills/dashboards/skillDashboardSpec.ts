/**
 * The skill board, composed — artboards `SkillsPanel` · `SkillFlow` ·
 * `SkillVersions` ([34r](../../../../../../docs/for-developers/the-screens.md)).
 *
 * A pure function of the reads the drawer already makes: the skill, its
 * version's plan, its versions, where it stands with each agent, and the
 * headline of its usage. It answers **what this playbook is and what it will
 * engage** — the declared tense. What *happened* when it was offered is the
 * usage board, and `Usage…` opens it
 * ([SD2](../../../../../../docs/for-developers/building-studio/skills-dashboards.md)).
 *
 * **The board reads.** Publishing lives in the Playbook tab beside the prose
 * being published ([SK6](../../../../../../docs/for-developers/modules/skills/features/authoring-a-skill.md)),
 * because a page anybody may open should not carry the one write that matters
 * most.
 */

import type { WithSkillFlow } from "@/pages/graphs-detail/features/skills/dashboards/SkillFlowPanel";
import {
	SKILL_ACTIONS,
	gapTile,
	skillVersionLabel,
	versionRow,
} from "@/pages/graphs-detail/features/skills/dashboards/shared";
import {
	VIEW_ACTION,
	VIEW_DASHBOARD,
	VIEW_SPEC,
	count,
	omit,
	specPanel,
} from "@/pages/graphs-detail/shared/dashboardSpec";
import type {
	BindRefusal,
	Skill,
	SkillAgentStanding,
	SkillPlanRead,
	SkillUsageResponse,
	SkillVersion,
} from "@/types/skills";
import type { DashboardSpec, PanelSpec } from "@invana/dashboard";

/** The one registered kind this board adds — Skills' own layer strip. */
export type SkillPanels = WithSkillFlow;

export interface SkillDashboardRead {
	skill: Skill;
	plan: SkillPlanRead | undefined;
	planLoading: boolean;
	versions: SkillVersion[];
	agents: SkillAgentStanding[];
	usage: SkillUsageResponse | undefined;
}

export interface SkillDashboardView {
	/** `Dashboard` or `spec.json`. */
	view: string;
}

export function skillDashboardSpec(
	read: SkillDashboardRead,
	{ view }: SkillDashboardView,
): DashboardSpec<SkillPanels> {
	const { skill } = read;
	const header: DashboardSpec<SkillPanels>["header"] = {
		crumbs: ["Skills", skill.name],
		chips: omit([
			{
				label: skillVersionLabel(skill),
				// A draft says so wherever it appears: nothing is offered a draft,
				// and a row that looked published would be the one lie this
				// surface can tell (SK21).
				variant: skill.is_draft ? ("outline" as const) : undefined,
			},
			skill.origin === "builtin"
				? { label: "builtin", variant: "outline" as const }
				: null,
			{ label: "skill board" },
		]),
		actions: omit([
			{ id: VIEW_ACTION, options: [VIEW_DASHBOARD, VIEW_SPEC], value: view },
			{
				id: SKILL_ACTIONS.openUsage,
				label: "Usage…",
				variant: "ghost" as const,
			},
			{ id: SKILL_ACTIONS.edit, label: "Edit", variant: "outline" as const },
		]),
	};

	const spec: DashboardSpec<SkillPanels> = {
		title: skill.name,
		header,
		rows: bands(read),
	};

	return view === VIEW_SPEC
		? { ...spec, rows: [{ panels: [specPanel(spec)] }] }
		: spec;
}

function bands({
	skill,
	plan,
	planLoading,
	versions,
	agents,
	usage,
}: SkillDashboardRead): DashboardSpec<SkillPanels>["rows"] {
	const current = versionRow(usage, skill.version);
	const bound = agents.filter((a) => a.bound);
	const refused = agents.filter((a) => !a.bound && a.refusal);
	const steps = plan?.nodes.length ?? skill.plan?.step_count ?? 0;
	const gap = gapTile(current);

	return omit<DashboardSpec<SkillPanels>["rows"][number]>([
		// A draft has been offered to nothing, so it draws no tiles at all —
		// four zeroes on a draft would read as a skill nobody applies rather
		// than as one nothing has ever been given (SK21 · SR34).
		skill.is_draft
			? null
			: {
					panels: [
						{
							kind: "metrics",
							options: {
								tiles: [
									{
										label: "Offered",
										value: count(current?.offered ?? 0),
										caption: "steps that had it in context",
									},
									{
										label: "Applied",
										value: count(current?.applied ?? 0),
										caption: "steps that reported using it",
									},
									{
										label: "The gap",
										value: gap.value,
										caption: gap.caption,
									},
									{
										label: "Bound to",
										value: `${bound.length} agent${bound.length === 1 ? "" : "s"}`,
										caption: bound.length
											? "it can reach a step"
											: "it never reaches a step",
									},
									{
										label: "Tasks",
										value: String(steps),
										caption: plan?.layers.length
											? plan.layers.join(" · ")
											: "the playbook, as a plan",
									},
								],
							},
						} as PanelSpec<SkillPanels>,
					],
				},
		{
			panels: [
				{
					kind: "text",
					title: "When to use",
					options: {
						// An empty trigger means *offered on every ask* — but only
						// on a published skill. A draft is offered to nobody, so
						// the same blank says something else entirely (SD10).
						text:
							skill.when_to_use.trim() ||
							(skill.is_draft
								? "Nothing published yet. The draft's trigger is in the drawer's Playbook tab, where it can still change."
								: "No when-to-use — it is offered on every ask."),
						tone: skill.when_to_use.trim() ? "default" : "muted",
					},
				} as PanelSpec<SkillPanels>,
			],
		},
		skill.content.trim()
			? {
					panels: [
						{
							kind: "code",
							title: "The playbook",
							aside: "the prose a step is offered, verbatim",
							flush: true,
							options: { language: "plain", value: skill.content },
						} as PanelSpec<SkillPanels>,
					],
				}
			: null,
		// SK13 — a version owns exactly one plan, so this band is never absent
		// and no surface branches on *does this skill have a flow*.
		// No pinned height: the strip is content-height, and the dashboard owns
		// the one scroller — a band that fixed its own would clip a plan with
		// six bands to make room for one with two.
		{
			panels: [
				{
					kind: "skillFlow",
					title: "The flow",
					aside: "declared, not touched — the six bands it will engage",
					options: {
						plan: plan ?? null,
						loading: planLoading,
						// The board reads the **published** version, so a draft
						// arrives here with nothing to draw and nothing wrong. The
						// drawer's default copy calls a planless version a fault,
						// which on a draft would accuse the engine of something it
						// did not do (SK21).
						empty: skill.is_draft
							? {
									title: "Nothing published yet",
									description:
										"This board draws the version a step is offered today, and a draft is offered to nobody. The draft's own flow is in the drawer's Flow tab, where it can still change.",
								}
							: undefined,
					},
				} as PanelSpec<SkillPanels>,
			],
		},
		// SK34 — each composition named once, with the rows it wrote counted off
		// `source_plan_key` rather than off the record, and *a newer version
		// exists* said rather than acted on (SK32).
		plan?.uses.length
			? {
					panels: [
						{
							kind: "list",
							title: "Composed",
							aside:
								"copied in at composition — re-inlining is something you ask for",
							options: {
								items: plan.uses.map((use) => {
									const rows = (plan.nodes ?? []).filter(
										(n) => n.source_plan_key === `${use.key}@${use.version}`,
									).length;
									return {
										id: `${use.key}@${use.version}`,
										title: `${use.key}@${use.version}`,
										meta: `${rows} step${rows === 1 ? "" : "s"}`,
										mono: true,
										chip:
											use.latest_version > use.version
												? {
														label: `v${use.latest_version} exists`,
														variant: "outline" as const,
													}
												: undefined,
									};
								}),
							},
						} as PanelSpec<SkillPanels>,
					],
				}
			: null,
		agents.length
			? {
					panels: [
						{
							kind: "table",
							title: "Bindings",
							aside: refused.length
								? `${bound.length} bound · ${refused.length} refused`
								: `${bound.length} bound`,
							flush: true,
							options: {
								columns: [
									{ key: "agent", label: "agent" },
									{ key: "standing", label: "standing" },
									{ key: "why", label: "what the check read" },
								],
								// A refusal names the check and the bound it read —
								// never grounds it did not check (BN7).
								rows: agents.map((a) => ({
									agent: a.agent_name,
									standing: a.bound
										? "bound"
										: a.refusal
											? "refused"
											: "not bound",
									why: a.bound
										? "—"
										: refusalReason(a.refusal) || "nothing refuses it",
								})),
							},
						} as PanelSpec<SkillPanels>,
					],
				}
			: null,
		versions.length
			? {
					panels: [
						{
							kind: "table",
							title: "Versions",
							aside:
								"a published version is immutable — evidence is per version",
							flush: true,
							options: {
								columns: [
									{ key: "version", label: "", mono: true },
									{ key: "description", label: "what changed" },
									{ key: "published", label: "published" },
									{
										key: "evidence",
										label: "offered / applied",
										align: "right",
									},
								],
								rows: versions.map((v) => {
									const row = versionRow(usage, v.version);
									return {
										version: `v${v.version}`,
										description: v.description || "—",
										published: v.published_at
											? v.published_at.slice(0, 10)
											: "draft",
										// Counted per version, never summed and never
										// read off a page (US3).
										evidence: row
											? row.enough_to_read
												? `${count(row.offered)} / ${count(row.applied)}`
												: `${count(row.offered)} · too few to read`
											: "—",
									};
								}),
							},
						} as PanelSpec<SkillPanels>,
					],
				}
			: null,
	]);
}

/**
 * The refusal's own words, and the bound it named.
 *
 * The engine ran both halves as a dry run and sent the facts unflattened
 * ([BN10](../../../../../../docs/for-developers/modules/skills/features/bindings.md));
 * this composes a line from them and re-reads none of the rules — a second
 * reading of the same rules in TypeScript is the copy that goes stale. A
 * refusal always names **which check** and **what it read**, because a refusal
 * on grounds it did not check is the one thing it may never be (BN7).
 */
function refusalReason(refusal: BindRefusal | null): string {
	if (!refusal) return "";
	if (refusal.message) return refusal.message;
	if (refusal.step_key)
		return `${refusal.check}: ${refusal.step_key} needs ${refusal.bound ?? "a bound"}`;
	if (refusal.layer)
		return `${refusal.check}: ${refusal.layer}${refusal.rule ? ` — ${refusal.rule}` : ""}`;
	return refusal.check;
}
