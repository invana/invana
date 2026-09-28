/**
 * The agent page's edit buffer — what **Save** sends, and nothing else.
 *
 * One buffer for all five tabs (AG23): a Save is one agent edit, one version,
 * whichever tabs the edits came from (AG28). Only the fields that moved are
 * sent, so saving an effort does not also re-send the soul and emit a voice
 * change nobody made.
 */

import type {
	Agent,
	AgentUpdate,
	SoulTraits,
} from "@/pages/graphs-detail/features/agents/types";

/** The envelope, as this page reads and writes it. */
export interface Envelope {
	entry?: string;
	allow?: string[];
	require?: { task: string; after: string }[];
	pins?: Record<string, Record<string, unknown>>;
	templates?: string[];
}

export interface AgentDraft {
	instructions: string;
	budget: Record<string, number>;
	effort: Record<string, number>;
	policy: Record<string, boolean>;
	spec: Envelope;
	soul: string;
	soul_traits: SoulTraits;
}

export const draftOf = (agent: Agent): AgentDraft => ({
	instructions: agent.instructions ?? "",
	budget: { ...(agent.budget ?? {}) },
	effort: { ...(agent.effort ?? {}) } as Record<string, number>,
	policy: { ...(agent.policy ?? {}) },
	spec: JSON.parse(JSON.stringify(agent.workflow_spec ?? {})) as Envelope,
	soul: agent.soul ?? "",
	soul_traits: { ...(agent.soul_traits ?? {}) },
});

const same = (a: unknown, b: unknown) =>
	JSON.stringify(a) === JSON.stringify(b);

/** The fields of `draft` that differ from the saved agent — the PATCH body. */
export function changesOf(agent: Agent, draft: AgentDraft): AgentUpdate {
	const saved = draftOf(agent);
	const out: AgentUpdate = {};
	if (draft.instructions !== saved.instructions)
		out.instructions = draft.instructions;
	if (!same(draft.budget, saved.budget)) out.budget = draft.budget;
	if (!same(draft.effort, saved.effort)) out.effort = draft.effort;
	if (!same(draft.policy, saved.policy)) out.policy = draft.policy;
	if (!same(draft.spec, saved.spec))
		out.workflow_spec = draft.spec as Record<string, unknown>;
	// `""` is a value here — it clears the soul back to the default voice.
	if (draft.soul !== saved.soul) out.soul = draft.soul;
	if (!same(draft.soul_traits, saved.soul_traits))
		out.soul_traits = draft.soul_traits;
	return out;
}

/**
 * Invana's default voice — the editor's placeholder when the soul is empty.
 *
 * A copy of `DEFAULT_VOICE` in `engine/src/invana/apps/llm/voice.py` (SO9):
 * the engine owns the words a run reads; this is only what the empty editor
 * shows. Change both together.
 */
export const DEFAULT_VOICE =
	"You are a colleague who knows this graph well. Speak in the first person, warmly and plainly. " +
	"Keep it brief: short sentences, no filler, no jargon the reader did not use. " +
	"When you can, end with one thing the reader could do or ask next.";

/** Each dial, its values in order, and its default — Invana's voice (AG16). */
export const DIALS: {
	key: keyof SoulTraits;
	label: string;
	values: string[];
	default: string;
}[] = [
	{
		key: "humour",
		label: "Humour",
		values: ["off", "light", "playful"],
		default: "light",
	},
	{
		key: "formality",
		label: "Formality",
		values: ["casual", "neutral", "formal"],
		default: "neutral",
	},
	{ key: "emoji", label: "Emoji", values: ["off", "on"], default: "off" },
	{ key: "greeting", label: "Greeting", values: ["off", "on"], default: "off" },
];

/** `light humour · neutral · no emoji · no greeting` — the dials in one line. */
export function voiceSummary(traits: SoulTraits): string {
	const v = (key: keyof SoulTraits) =>
		traits[key] ?? DIALS.find((d) => d.key === key)?.default;
	return [
		v("humour") === "off" ? "no humour" : `${v("humour")} humour`,
		v("formality"),
		v("emoji") === "on" ? "emoji" : "no emoji",
		v("greeting") === "on" ? "greets" : "no greeting",
	].join(" · ");
}

const EFFORT_WORDS: { key: string; word: string }[] = [
	{ key: "max_steps", word: "steps" },
	{ key: "max_replans", word: "replans" },
	{ key: "max_clarifications", word: "questions" },
];

/** `16 steps · 1 replan · 3 questions` */
export function effortSummary(effort: Record<string, number>): string {
	return EFFORT_WORDS.map(({ key, word }) => {
		const n = effort[key];
		return `${n} ${n === 1 ? word.replace(/s$/, "") : word}`;
	}).join(" · ");
}
