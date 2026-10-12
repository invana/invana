/**
 * The words a project speaks in — its type's labels for a branch, evidence, a
 * verdict and a decision (projects.md › Project types) — and the tones every
 * record draws with.
 *
 * The engine stores the canonical words and relabels on the way out
 * (`Project.words`); these tables are the fallback for a project read before
 * its words arrive, and the copy the *New project* type cards show before
 * there is a project to ask.
 */

import type {
	BranchStatus,
	Choice,
	Project,
	ProjectType,
	Stance,
	Verdict,
} from "../types";

export type Tone =
	| "success"
	| "warning"
	| "destructive"
	| "info"
	| "muted"
	| "primary";

/** The types that can be created today; the others are refused by the engine. */
export const LAUNCHED_TYPES: readonly ProjectType[] = [
	"research",
	"policy",
	"general",
];

export const TYPES: readonly {
	type: ProjectType;
	label: string;
	/** branch · evidence · the verdicts or decisions, as the card reads. */
	words: string;
}[] = [
	{
		type: "research",
		label: "Research",
		words: "hypothesis · finding · supported / refuted",
	},
	{
		type: "investment",
		label: "Investment",
		words: "thesis · signal · invest / hold / pass",
	},
	{
		type: "policy",
		label: "Policy",
		words: "option · evidence · adopt / amend / reject",
	},
	{
		type: "market",
		label: "Market",
		words: "position · insight · go / revise / no-go",
	},
	{
		type: "investigation",
		label: "Investigation",
		words: "lead · evidence · confirmed / ruled out",
	},
	{
		type: "general",
		label: "General",
		words: "option · evidence · choose / park / drop",
	},
];

export function typeLabel(type: ProjectType): string {
	return TYPES.find((t) => t.type === type)?.label ?? type;
}

const VERDICTS: Verdict[] = ["supported", "refuted", "inconclusive"];
const CHOICES: Choice[] = ["pursue", "park", "drop", "merge"];

const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** What a branch is called in this project — `Hypothesis`, `Option`, `Lead`. */
export function branchWord(project: Project): string {
	return capital(project.words?.branch ?? "branch");
}

/** What evidence is called — `Finding`, `Evidence`, `Signal`. */
export function evidenceWord(project: Project): string {
	return capital(project.words?.evidence ?? "finding");
}

/**
 * A branch's short name — the branch word's initial and its number: `H3` in a
 * research project, `O3` in a policy one. People type the number, so the
 * label never hides it.
 */
export function branchLabel(project: Project, n: number): string {
	return `${branchWord(project).charAt(0)}${n}`;
}

export function verdictOptions(project: Project) {
	return VERDICTS.map((v) => ({
		value: v,
		label: capital(project.words?.verdicts?.[v] ?? v),
	}));
}

export function choiceOptions(project: Project) {
	return CHOICES.map((c) => ({
		value: c,
		label:
			c === "merge" ? "Merge into…" : capital(project.words?.choices?.[c] ?? c),
	}));
}

export function verdictLabel(project: Project, v: Verdict): string {
	return project.words?.verdicts?.[v] ?? v;
}

export function choiceLabel(project: Project, c: Choice): string {
	return project.words?.choices?.[c] ?? c;
}

export const STATUS_TONE: Record<BranchStatus, Tone> = {
	open: "info",
	pursuing: "success",
	parked: "muted",
	dropped: "destructive",
	merged: "primary",
};

/** A badge tone as a row's status dot, which has no `primary` or `destructive`. */
export function dotTone(
	t: Tone,
): "info" | "success" | "warning" | "muted" | "error" {
	return t === "destructive" ? "error" : t === "primary" ? "info" : t;
}

export const STANCE_TONE: Record<Stance, Tone> = {
	supports: "success",
	contradicts: "destructive",
	context: "muted",
};

/** `3 supports · 1 contradicts` — the balance a branch header carries. */
export function balance(b: {
	supports: number;
	contradicts: number;
	context: number;
}): string {
	const parts = [
		b.supports ? `${b.supports} supports` : null,
		b.contradicts ? `${b.contradicts} contradicts` : null,
		b.context ? `${b.context} context` : null,
	].filter(Boolean);
	return parts.length ? parts.join(" · ") : "no evidence yet";
}

export const plural = (n: number, one: string, many = `${one}s`) =>
	`${n} ${n === 1 ? one : many}`;

export function shortDate(iso: string): string {
	return new Date(iso).toLocaleDateString(undefined, {
		month: "short",
		day: "numeric",
	});
}
