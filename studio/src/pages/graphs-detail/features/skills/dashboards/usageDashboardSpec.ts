/**
 * The usage board, composed — artboards `SkillUsage` · `UsageVersions` ·
 * `UsageReadings` · `UsageSeams`
 * ([34s](../../../../../../docs/for-developers/the-screens.md)).
 *
 * A pure function of one `GET …/skills/{id}/usage`: the tiles, every published
 * version, the current version by agent and by outcome, the bounded step list,
 * and the four readings of a gap. Nothing here fetches and nothing here
 * renders.
 *
 * **The engine sends counts and says whether they are readable; this file never
 * computes a percentage from a bucket the engine called unreadable**
 * ([US6](../../../../../../docs/for-developers/modules/skills/features/usage.md)).
 * And versions are never summed: 2,786 offers across seven texts is a number
 * drawn nowhere, because *offered 1,204, applied 1,190* is a claim about **one
 * text** ([US3](../../../../../../docs/for-developers/modules/skills/features/usage.md)).
 */

import {
	SKILL_ACTIONS,
	gapTile,
	readsAs,
	skillVersionLabel,
	versionRow,
	when,
} from "@/pages/graphs-detail/features/skills/dashboards/shared";
import {
	VIEW_ACTION,
	VIEW_DASHBOARD,
	VIEW_SPEC,
	count,
	omit,
	specPanel,
} from "@/pages/graphs-detail/shared/dashboardSpec";
import type { Skill, SkillUsageResponse } from "@/types/skills";
import type { DashboardSpec, PanelSpec } from "@invana/dashboard";

export interface UsageDashboardView {
	/** `Dashboard` or `spec.json`. */
	view: string;
	/** Which published version the tiles are of. Null reads the newest. */
	version: number | null;
}

/**
 * The four readings of a gap, and the move each one names.
 *
 * The same table on every skill, which is the argument **for** drawing it: a
 * number is only worth showing if the reader knows which of four sentences it
 * is, and a reading guide behind a hover is a guide nobody reads
 * ([US8](../../../../../../docs/for-developers/modules/skills/features/usage.md)).
 */
const READINGS: Array<Record<string, string>> = [
	{
		shape: "a big gap, one agent",
		because: "wrong agent — the trigger does not fit what it does",
		move: "unbind it there",
	},
	{
		shape: "a big gap, every agent",
		because: "the trigger never matched reality",
		move: "rewrite when_to_use",
	},
	{
		shape: "applied, and the run still failed",
		because: "the content is wrong, not the trigger",
		move: "rewrite the playbook",
	},
	{
		shape: "applied, and the run served",
		because: "it fits",
		move: "leave it alone",
	},
	{
		shape: "bound, never offered",
		because: "this agent runs no task the skill is for",
		move: "nothing — or unbind, for the context",
	},
];

export function usageDashboardSpec(
	skill: Skill,
	usage: SkillUsageResponse,
	{ view, version }: UsageDashboardView,
): DashboardSpec {
	const row = versionRow(usage, version);
	const current = row?.version ?? skill.version;
	const isCurrent = row?.skill_version_id === usage.current_version_id;
	// A draft has never been published, so there is no text these counts are
	// of. Saying `v0` would name a version that does not exist, and *an
	// earlier text* would claim the reader moved off the current one (SD10).
	const published = usage.versions.length > 0;

	const header: DashboardSpec["header"] = {
		crumbs: ["Skills", skill.name, "usage"],
		chips: omit([
			{ label: published ? `v${current}` : skillVersionLabel(skill) },
			published && !isCurrent
				? { label: "an earlier text", tone: "muted" as const }
				: null,
			{ label: "whole Graph" },
			{ label: "usage board" },
		]),
		actions: omit([
			{ id: VIEW_ACTION, options: [VIEW_DASHBOARD, VIEW_SPEC], value: view },
			// Every published version, as one decision with several positions —
			// picking one is a reading, not navigation, so it never opens a tab.
			usage.versions.length > 1
				? {
						id: SKILL_ACTIONS.version,
						options: usage.versions.map((v) => `v${v.version}`),
						value: `v${current}`,
					}
				: null,
			{
				id: SKILL_ACTIONS.openSkill,
				label: "The skill",
				variant: "ghost" as const,
			},
		]),
	};

	const spec: DashboardSpec = {
		title: `${skill.name} · usage`,
		header,
		rows: bands(usage, row, isCurrent),
	};

	return view === VIEW_SPEC
		? { ...spec, rows: [{ panels: [specPanel(spec)] }] }
		: spec;
}

function bands(
	usage: SkillUsageResponse,
	row: ReturnType<typeof versionRow>,
	isCurrent: boolean,
): DashboardSpec["rows"] {
	const bound = usage.used_by.length;
	const gap = gapTile(row);

	const tiles: PanelSpec = {
		kind: "metrics",
		options: {
			tiles: [
				{
					label: "Offered",
					value: count(row?.offered ?? 0),
					caption: "steps that had it in context",
				},
				{
					label: "Applied",
					value: count(row?.applied ?? 0),
					caption: "steps that reported using it",
				},
				{ label: "The gap", value: gap.value, caption: gap.caption },
				{
					label: "Bound to",
					value: `${bound} agent${bound === 1 ? "" : "s"}`,
					caption: bound ? "it can reach a step" : "it never reaches a step",
				},
			],
		},
	};

	return omit<DashboardSpec["rows"][number]>([
		{ panels: [tiles] },
		// US4 — the number is a claim, and the surface says so where the number
		// is read rather than in a footnote. Absent when nothing has claimed
		// anything: there is no report to qualify.
		row && row.applied > 0
			? {
					panels: [
						{
							kind: "text",
							options: {
								callout: true,
								tone: "muted",
								text: `${count(row.applied)} steps said they used it. Nothing checks they used it well — application is self-reported, and this number is never labelled verified.`,
							},
						} as PanelSpec,
					],
				}
			: null,
		// Per version is the board's second claim, so the slot always carries
		// something — but a draft has no published text, and a table of column
		// headings over no rows is the empty grid this module refuses
		// everywhere else (SD10 · SR34).
		usage.versions.length === 0
			? {
					panels: [
						{
							kind: "text",
							options: {
								callout: true,
								tone: "muted",
								text: "Nothing is published yet. A draft is offered to nobody, so there is no text for these counts to belong to — publish a version and the first offer lands here.",
							},
						} as PanelSpec,
					],
				}
			: {
					panels: [
						{
							kind: "table",
							title: "Per version",
							aside:
								"a count belongs to one published text — they are never summed",
							flush: true,
							options: {
								columns: [
									{ key: "version", label: "", mono: true },
									{ key: "offered", label: "offered", align: "right" },
									{ key: "applied", label: "applied", align: "right" },
									{ key: "gap", label: "gap", align: "right" },
									{ key: "reads", label: "what it reads as" },
								],
								rows: usage.versions.map((v) => ({
									version: `v${v.version}`,
									offered: count(v.offered),
									applied: count(v.applied),
									// A gap below the floor is not a gap yet — the same `—`
									// the tile draws, for the same reason (US9).
									gap: v.enough_to_read ? count(v.gap) : "—",
									reads: readsAs(v),
								})),
							},
						} as PanelSpec,
					],
				},
		usage.by_agent.length
			? {
					panels: [
						{
							kind: "table",
							title: "By agent",
							aside: isCurrent
								? "the current version · the agent is the run's"
								: "the current version's — an earlier text has no breakdown",
							flush: true,
							options: {
								columns: [
									{ key: "agent", label: "agent" },
									{ key: "offered", label: "offered", align: "right" },
									{ key: "applied", label: "applied", align: "right" },
									{ key: "gap", label: "gap", align: "right" },
								],
								rows: usage.by_agent.map((a) => ({
									agent: a.agent_name ?? "no agent",
									offered: count(a.offered),
									applied: count(a.applied),
									gap: a.enough_to_read ? count(a.gap) : "—",
								})),
							},
						} as PanelSpec,
					],
				}
			: null,
		usage.by_outcome.length
			? {
					panels: [
						{
							kind: "table",
							title: "By outcome",
							aside: "the run's outcome, not the step's",
							flush: true,
							options: {
								columns: [
									{ key: "outcome", label: "the run ended" },
									{ key: "offered", label: "offered", align: "right" },
									{ key: "applied", label: "applied", align: "right" },
									{ key: "gap", label: "gap", align: "right" },
								],
								rows: usage.by_outcome.map((o) => ({
									outcome: o.outcome ?? "still running",
									offered: count(o.offered),
									applied: count(o.applied),
									gap: o.enough_to_read ? count(o.gap) : "—",
								})),
							},
						} as PanelSpec,
					],
				}
			: null,
		// A list, not a table: these are records you scan and open, and every
		// row opens the run it came from (C6). The counts above are **not**
		// taken from this window, which the aside says rather than implies.
		//
		// **A row is a step, so its id is the step's.** Two steps of one run are
		// two rows — keying them by the run made them one key twice, which React
		// collapses, and the page resolves the run from the step it was given.
		// A step whose root run is gone carries no action: a row that cannot
		// open does not offer to.
		usage.recent_steps.length
			? {
					panels: [
						{
							kind: "list",
							title: "Recent steps",
							aside:
								"newest first, bounded — the counts above are not from this window",
							options: {
								items: usage.recent_steps.map((step) => ({
									id: step.step_id,
									title: step.task_key || step.label,
									meta: when(step.finished_at),
									mono: true,
									chip: step.reported
										? { label: "applied", tone: "success" as const }
										: { label: "offered", variant: "outline" as const },
									action: step.run_id ? SKILL_ACTIONS.openRun : undefined,
								})),
							},
						} as PanelSpec,
					],
				}
			: null,
		{
			panels: [
				{
					kind: "table",
					title: "What each reading means",
					aside: "the gap is the signal — never a score",
					flush: true,
					options: {
						columns: [
							{ key: "shape", label: "the shape" },
							{ key: "because", label: "because" },
							{ key: "move", label: "what to do" },
						],
						rows: READINGS,
					},
				} as PanelSpec,
			],
		},
		// The whole module's line, said where the move is decided: a gap is a
		// question about a binding or a sentence, never about the model (S1).
		{
			panels: [
				{
					kind: "text",
					options: {
						tone: "muted",
						text: "A gap is a question about a binding or a sentence, never about the model. Neither skills nor rules are enforced — the moves are rewriting when_to_use, rewriting the playbook, and unbinding.",
					},
				} as PanelSpec,
			],
		},
	]);
}
