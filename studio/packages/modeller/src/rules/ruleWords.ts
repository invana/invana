/**
 * How a rule reads in words — its scope, the acts it is checked on, and what
 * its 30-day count means for its mode. One place, so the row and the dialog
 * say the same thing.
 */

import type {
	Rule,
	RuleAct,
	RuleCheckKind,
	RuleMode,
	RuleScope,
} from "@invana-studio/core";

export const ACT_LABEL: Record<RuleAct, string> = {
	"dataset.share": "Dataset share",
	"dataset.bind": "Dataset bind",
	"project.decide": "Project decision",
};

/** Lowercase, for the middle of a row's line: `on dataset share and bind`. */
const ACT_WORD: Record<RuleAct, string> = {
	"dataset.share": "dataset share",
	"dataset.bind": "dataset bind",
	"project.decide": "a project decision",
};

export const SCOPE_LABEL: Record<RuleScope, string> = {
	install: "Install",
	graph: "Graph",
	project: "Project",
};

export const MODE_LABEL: Record<RuleMode, string> = {
	block: "Block",
	warn: "Warn",
	report: "Report",
};

/** The check kinds, in the order the dialog offers them, and the scopes each sits on. */
export const CHECKS: {
	kind: RuleCheckKind;
	label: string;
	acts: RuleAct[];
	scopes: RuleScope[];
}[] = [
	{
		kind: "evidence.reviewed",
		label: "Cited evidence was reviewed by a person",
		acts: ["project.decide"],
		scopes: ["install", "graph", "project"],
	},
	{
		kind: "evidence.not_retracted",
		label: "Cited evidence cites no retracted dataset",
		acts: ["project.decide"],
		scopes: ["install", "graph", "project"],
	},
	{
		kind: "dataset.licence",
		label: "The dataset's licence is one allowed",
		acts: ["dataset.share", "dataset.bind"],
		scopes: ["install", "graph"],
	},
	{
		kind: "dataset.conforms",
		label: "The dataset conforms to a standard",
		acts: ["dataset.share", "dataset.bind"],
		scopes: ["install", "graph"],
	},
];

/** `install` · `Graph airways` · `project Drought-tolerant chickpea`. */
export function scopeWords(rule: Rule): string {
	if (rule.scope === "install") return "install";
	if (rule.scope === "project")
		return `project ${rule.project_name ?? rule.project_key ?? ""}`.trim();
	return `Graph ${rule.graph_name ?? ""}`.trim();
}

/** `on dataset share and dataset bind` · `offered only`. */
export function actsWords(acts: RuleAct[] | undefined): string {
	if (!acts?.length) return "offered only";
	const words = acts.map((a) => ACT_WORD[a]);
	return `on ${words.length > 1 ? `${words.slice(0, -1).join(", ")} and ${words.at(-1)}` : words[0]}`;
}

/** What the window's count means for this mode. */
export function brokenWords(mode: RuleMode | null | undefined): string {
	return mode === "block"
		? "would have stopped"
		: mode === "report"
			? "would have reported"
			: "would have warned on";
}

/** The row's line under the statement. */
export function ruleLine(rule: Rule): string {
	const parts = [scopeWords(rule), actsWords(rule.acts)];
	if (rule.mode) parts.push(rule.mode);
	if (rule.broken_30d != null)
		parts.push(
			rule.broken_30d === 0
				? "0 broken in 30 days"
				: `${rule.broken_30d} broken in 30 days`,
		);
	if (!rule.active) parts.push("not offered");
	return parts.join(" · ");
}
