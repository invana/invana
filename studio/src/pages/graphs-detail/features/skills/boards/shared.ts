/**
 * What the three Skills boards agree on.
 *
 * `skill`, `skill_usage` and `rule` are composed from different reads, but they
 * read the same two certainties — **offered** is a fact the engine wrote when
 * it built the context, **applied** (or **cited**) is the model's own claim —
 * and the vocabulary for saying so honestly lives here rather than three times
 * ([S1](../../../../../../docs/for-developers/modules/skills/spec.md) ·
 * [US4](../../../../../../docs/for-developers/modules/skills/features/usage.md) ·
 * [RU7](../../../../../../docs/for-developers/modules/skills/features/rules.md)).
 *
 * Nothing here fetches and nothing here renders: a composer is a pure function
 * of one read, which is what lets `spec.json` show the document the page is.
 */

import { formatRelativeTime } from "@/lib/time";
import type {
	Rule,
	Skill,
	SkillUsageResponse,
	SkillUsageVersion,
} from "@/types/skills";

/** Action ids the three pages answer. The spec carries the string; the page carries the behaviour. */
export const SKILL_ACTIONS = {
	/** `Dashboard ¦ spec.json`. */
	view: "view",
	/** Which published version the tiles and the flow are of. */
	version: "version",
	/** `Usage…` — opens `skill_usage:<id>` as its own page. */
	openUsage: "open-usage",
	/** `The skill` — back from the usage board to what it is a reading of. */
	openSkill: "open-skill",
	/** A Bindings row — opens that agent in the Agents panel. */
	openAgent: "open-agent",
	/** `Edit` — puts the drawer back on this record, drilled in. */
	edit: "edit",
	/** A step or citation row — opens the run it came from. */
	openRun: "open-run",
} as const;

/**
 * What a tile says when there is a count but no reading, and when there is
 * neither.
 *
 * Both draw `—` on purpose: neither is a statistic, and a gap of `0` would read
 * as *applied every time* — the one claim an absent record must not make. The
 * caption is the only thing that tells them apart
 * ([US9](../../../../../../docs/for-developers/modules/skills/features/usage.md)),
 * so it is never dropped.
 */
export function gapTile(row: SkillUsageVersion | null | undefined): {
	value: string;
	caption: string;
} {
	if (!row || row.offered === 0) return { value: "—", caption: "no data yet" };
	if (!row.enough_to_read) return { value: "—", caption: "too few to read" };
	return { value: row.gap.toLocaleString(), caption: "offered minus applied" };
}

/**
 * How a bucket reads in words — never a percentage.
 *
 * The engine owns the floor and sends `enough_to_read`, so the API, the CLI and
 * Studio all say *too few to read* at the same point instead of each picking a
 * threshold ([US6](../../../../../../docs/for-developers/modules/skills/features/usage.md)).
 * The percentage below is a **reading of a readable bucket**, computed nowhere
 * else and never shown for one the engine called unreadable.
 */
export function readsAs(row: {
	offered: number;
	applied: number;
	enough_to_read: boolean;
}): string {
	if (row.offered === 0) return "never offered";
	if (!row.enough_to_read) return "too few to read";
	return `${Math.round((row.applied / row.offered) * 100)}% applied`;
}

/** The version row the page is reading — the picked one, else the newest. */
export function versionRow(
	usage: SkillUsageResponse | undefined,
	version: number | null,
): SkillUsageVersion | null {
	const rows = usage?.versions ?? [];
	if (!rows.length) return null;
	return (version ? rows.find((r) => r.version === version) : null) ?? rows[0];
}

/** `v7` · `draft` — what a skill's badge says. */
export function skillVersionLabel(skill: Skill): string {
	return skill.is_draft ? "draft" : `v${skill.version}`;
}

/** A rule is its statement, so the crumb is the statement — shortened, never reworded. */
export function ruleTitle(rule: Rule): string {
	const statement = rule.statement.trim();
	return statement.length > 60 ? `${statement.slice(0, 59)}…` : statement;
}

/** `2m ago`, or nothing at all — an absent instant is absent, not `never`. */
export function when(at: string | null | undefined): string {
	return at ? formatRelativeTime(new Date(at)) : "—";
}

/** A short id, the way every trace surface writes one. */
export function shortId(id: string | null | undefined): string {
	return id ? id.slice(-4) : "—";
}
