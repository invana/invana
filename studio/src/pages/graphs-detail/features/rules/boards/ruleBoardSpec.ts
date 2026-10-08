/**
 * The rule board, composed — artboards `RulesPanel` · `RuleCited`
 * ([34t](../../../../../../docs/for-developers/the-screens.md)).
 *
 * A pure function of the rule and one `GET …/rules/{id}/citations`: the
 * statement, **offered · cited · never cited**, the row with its two derived
 * words, every wording with its own count, and the steps that cited one.
 *
 * `offered` is a fact written by assembly; `cited` is the model's own claim,
 * and the difference is *never cited* — which cannot be told from *never
 * offered* unless both are read
 * ([rules.md](../../../../../../docs/for-developers/modules/skills/features/rules.md) ·
 * [rules.md](../../../../../../docs/for-developers/modules/skills/features/rules.md)).
 *
 * **The board reads.** Deactivating keeps its dialog in the section, where *what
 * stops* and *what stays* can be read at the moment of the act
 * ([rules.md](../../../../../../docs/for-developers/modules/skills/features/rules.md)).
 */

import type { BoardSpec, PanelSpec } from "@invana/boards";
import type {
	Rule,
	RuleCitationsResponse,
} from "@/pages/graphs-detail/features/skills";
import {
	ruleTitle,
	SKILL_ACTIONS,
	when,
} from "@/pages/graphs-detail/features/skills";
import {
	count,
	omit,
	specPanel,
	VIEW_ACTION,
	VIEW_DASHBOARD,
	VIEW_SPEC,
} from "@/pages/graphs-detail/shared/dashboardSpec";

export interface RuleBoardView {
	/** `Dashboard` or `spec.json`. */
	view: string;
}

/**
 * The one question that places a statement: **must it be enforced?**
 *
 * Four statements, each landing somewhere else. It is the same table on every
 * rule, and it is on the surface rather than in a doc because the mistake it
 * prevents — writing a guardrail, a criterion or a skill as a rule — is made at
 * the moment somebody is reading one ([rules.md](../../../../../../docs/for-developers/modules/skills/features/rules.md)).
 */
const NOT_A_RULE: Array<Record<string, string>> = [
	{
		statement: "“Never call a third party.”",
		because: "must be enforced",
		really: "a guardrail — Govern",
	},
	{
		statement: "“Every number must be cited.”",
		because: "decides whether a Todo is done",
		really: "a criterion — Work",
	},
	{
		statement: "“How to chase a late supplier.”",
		because: "has steps",
		really: "a skill — it draws as a flow",
	},
	{
		statement: "“Prefer supplier names over ids.”",
		because: "is simply true here",
		really: "a rule",
	},
];

export function ruleBoardSpec(
	rule: Rule,
	citations: RuleCitationsResponse | undefined,
	{ view }: RuleBoardView,
): BoardSpec {
	const header: BoardSpec["header"] = {
		crumbs: ["Rules", ruleTitle(rule)],
		chips: omit([
			{ label: rule.kind },
			{ label: `v${rule.version}` },
			// An inactive rule is dimmed in place, never removed: deactivating is
			// not deleting, and its citations still resolve.
			rule.active ? null : { label: "inactive", tone: "muted" as const },
			{ label: "rule board" },
		]),
		actions: [
			{ id: VIEW_ACTION, options: [VIEW_DASHBOARD, VIEW_SPEC], value: view },
			{ id: SKILL_ACTIONS.edit, label: "Edit", variant: "outline" as const },
		],
	};

	const spec: BoardSpec = {
		title: ruleTitle(rule),
		header,
		rows: bands(rule, citations),
	};

	return view === VIEW_SPEC
		? { ...spec, rows: [{ panels: [specPanel(spec)] }] }
		: spec;
}

function bands(
	rule: Rule,
	citations: RuleCitationsResponse | undefined,
): BoardSpec["rows"] {
	const offered = citations?.offered ?? 0;
	const cited = citations?.total ?? rule.citations;
	// Only a fact minus a fact. Without offers this is not a smaller number —
	// it is not a number at all, and the tile is absent rather than zero.
	const neverCited = offered > 0 ? offered - cited : null;

	return omit<BoardSpec["rows"][number]>([
		// The statement is the rule, so it is the page's first band rather than
		// a field in a properties table.
		{
			panels: [
				{
					kind: "text",
					options: { text: rule.statement },
				} as PanelSpec,
			],
		},
		{
			panels: [
				{
					kind: "grid",
					options: {
						tiles: omit([
							offered > 0
								? {
										label: "Offered",
										value: count(offered),
										delta: "steps in scope had it",
									}
								: null,
							{
								label: "Cited",
								value: count(cited),
								delta: "steps said they followed it",
							},
							neverCited != null
								? {
										label: "Never cited",
										value: count(neverCited),
										delta: "not the same as never offered",
									}
								: null,
							{
								label: "Versions",
								value: String(citations?.versions.length ?? rule.version),
								delta: "each immutable once published",
							},
						]),
					},
				} as PanelSpec,
			],
		},
		// The one band that states what is derived. `scope` and `kind` are read
		// off `project_id` and are not columns — saying so here is what keeps
		// the surface from implying there are three axes.
		{
			panels: [
				{
					kind: "record",
					title: "The row",
					aside: "scope and kind are derived from project_id",
					options: {
						rows: [
							{ label: "statement", value: rule.statement },
							{ label: "kind", value: `${rule.kind} (derived)` },
							{ label: "scope", value: `${rule.scope} (derived)` },
							{
								label: "order",
								value: `${rule.order} — sequence in context, not importance`,
							},
							{ label: "active", value: String(rule.active) },
							{ label: "version", value: `v${rule.version}`, mono: true },
							{ label: "citations", value: `${count(cited)} steps` },
						],
					},
				} as PanelSpec,
			],
		},
		citations?.versions.length
			? {
					panels: [
						{
							kind: "table",
							title: "Versions",
							aside:
								"editing publishes the next one; the previous keeps resolving",
							flush: true,
							options: {
								columns: [
									{ key: "version", label: "", mono: true },
									{ key: "statement", label: "the wording", mono: true },
									{ key: "published", label: "published", mono: true },
									{ key: "cited", label: "cited", align: "right", mono: true },
								],
								// Each count is the engine's, per wording — never
								// tallied from the bounded list below.
								rows: citations.versions.map((v) => ({
									version: `v${v.version}`,
									statement: v.statement,
									published: v.published_at.slice(0, 10),
									cited: count(v.cited),
								})),
							},
						} as PanelSpec,
					],
				}
			: null,
		// A list, not a table: these are records you open. Each row resolves to
		// the wording it was offered, which is what rewording never rewrites.
		citations?.items.length
			? {
					panels: [
						{
							kind: "list",
							title: "Where it was cited",
							aside: "a citation resolves to the version offered",
							options: {
								// A citation is a **step**, so the row's id is the step's:
								// two steps of one run cite it twice and are two rows.
								// The page resolves the run from the step it was given,
								// and a step whose root run is gone carries no action.
								items: citations.items.map((c) => ({
									id: c.step_id,
									title: `${c.task_key || c.label} · v${c.version}`,
									meta: when(c.finished_at),
									mono: true,
									action: c.run_id ? SKILL_ACTIONS.openRun : undefined,
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
					title: "What is not a rule",
					aside: "the test is one question: must it be enforced?",
					flush: true,
					options: {
						columns: [
							{ key: "statement", label: "the statement", mono: true },
							{ key: "because", label: "because it…", mono: true },
							{ key: "really", label: "is really", mono: true },
						],
						rows: NOT_A_RULE,
					},
				} as PanelSpec,
			],
		},
		{
			panels: [
				{
					kind: "text",
					options: {
						tone: "muted",
						text: "One statement per rule. If it needs a paragraph it is two rules — a step cites the rule it followed, and a rule is offered and cited, never enforced.",
					},
				} as PanelSpec,
			],
		},
	]);
}
