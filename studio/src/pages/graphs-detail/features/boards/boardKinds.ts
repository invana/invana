/**
 * The board `kind` registry — one flat axis, and the law that governs a click
 * on each ([boards-migration § 5](../../../../../../docs/for-developers/building-engine/boards-migration.md)).
 *
 * `kind` is **one column of ten values**. Whether a board is *drawn* or
 * *declared* is `renders`, a trait of the row here — not a second column, which
 * would make `kind=canvas, subject=run` representable and meaningless (B3).
 * The engine mirrors this table in `apps/boards/kinds.py`, and
 * `tests/golden/openapi.json` pins the enum that keeps the two honest.
 *
 * ## The canvas law (docs/for-developers/modules/explore/features/selection-and-the-panel.md, `studio.md` § 6)
 *
 * > The canvas **selects and draws**. The panel **edits**. A gesture on the
 * > canvas writes only where the **geometry is the datum** — drawing an edge
 * > *is* creating the relationship — and even then it hands off to the same
 * > form the panel uses.
 *
 * Exactly **three** of the six drawn kinds write from a gesture — `model`,
 * `plan`, and `workflow` while drafting — and each writes an edge or a
 * placement, because drawing it is the only natural way to say it. Everything
 * a user would call a "setting" — a name, an arg, a budget, an assignee, a
 * colour — is edited in a form, on every kind, with no exception; on
 * `workflow` that form is `bottomSection`, not the panel and never a card
 * floating over the drawing (draft-a-plan.md DP11). A new exception is argued
 * in the feature file, never added in code. A declared kind has no gesture at
 * all.
 *
 * ## Why this file exists
 *
 * `BoardPagesViewPanel` switches tools, inspector, legend and footer by kind
 * (docs/for-developers/modules/explore/spec.md / docs/for-developers/modules/explore/features/selection-and-the-panel.md F4), and the selection handler branches by kind too.
 * Keeping the table here means those two never drift, and adding a kind is one
 * entry rather than a hunt.
 */

import {
	Bot,
	Boxes,
	Database,
	FileCode,
	GitBranch,
	GitCompareArrows,
	Globe,
	History,
	LayoutDashboard,
	ListTree,
	Quote,
	Scale,
	ShieldCheck,
	SlidersHorizontal,
	SquareActivity,
	TrendingUp,
	Workflow,
} from "lucide-react";
import type { ElementType } from "react";

export type CanvasKind =
	| "data"
	| "model"
	| "plan"
	| "workflow"
	| "envelope"
	| "lineage"; // nothing to show, and nowhere to go

export interface CanvasKindSpec {
	kind: CanvasKind;
	label: string;
	icon: ElementType;
	/** What the nodes stand for — the legend's first line. */
	nodes: string;
	/** What the edges stand for. */
	edges: string;
	/**
	 * Whether a canvas **gesture** writes. True for exactly `model` and `plan`;
	 * see the law above before adding a third.
	 */
	writesFromGesture: boolean;
	/** Which panel holds this kind's detail block. */
	panel: string;
	/** The Layers panel is a `data`-only affordance (docs/for-developers/modules/explore/features/selection-and-the-panel.md). */
	hasLayers: boolean;
	/** Per-kind footer copy, before any live counts are appended. */
	footer: string;
}

export const CANVAS_KINDS: Record<CanvasKind, CanvasKindSpec> = {
	data: {
		kind: "data",
		label: "Board",
		icon: Database,
		nodes: "records in the bound graph",
		edges: "relationships",
		// The bound graph DB is read-only from Studio: `execute.read_only` is
		// pinned on every agent's envelope, and the validator rejects a plan
		// that tries to unset it.
		writesFromGesture: false,
		panel: "sessions",
		hasLayers: true,
		footer: "ACTIVE",
	},
	model: {
		kind: "model",
		label: "Model",
		icon: Boxes,
		nodes: "node types",
		edges: "edge types",
		// Add · Connect · Delete, on an editable draft only (docs/for-developers/modules/connect-and-model/features/model-editor.md).
		writesFromGesture: true,
		panel: "model",
		hasLayers: false,
		footer: "DRAFT",
	},
	plan: {
		kind: "plan",
		label: "Plan",
		icon: ListTree,
		nodes: "tasks",
		edges: "dependencies (finish → start)",
		// Drag card → card adds a dependency (docs/for-developers/modules/work/spec.mda).
		writesFromGesture: true,
		panel: "projects",
		hasLayers: false,
		footer: "PLAN",
	},
	workflow: {
		kind: "workflow",
		label: "Workflow",
		icon: Workflow,
		nodes: "steps",
		// biome-ignore lint/suspicious/noTemplateCurlyInString: the copy shows the binding syntax itself
		edges: "required order + ${steps.X.y} bindings",
		// Authoring a workflow is out of MVP; a canvas is not a loophole in a
		// threat model (docs/for-developers/modules/explore/features/selection-and-the-panel.md).
		writesFromGesture: false,
		// The library is **Library › Plans**; a workflow is a reusable TaskPlan, not
		// a panel of its own (G30 · G41).
		panel: "library",
		hasLayers: false,
		footer: "LIBRARY",
	},
	envelope: {
		kind: "envelope",
		label: "Envelope",
		icon: Bot,
		nodes: "allowed / disallowed steps",
		edges: "require preconditions",
		// The envelope *is* editable — but in the panel, with Save.
		writesFromGesture: false,
		panel: "agents",
		hasLayers: false,
		footer: "ENVELOPE",
	},
	lineage: {
		kind: "lineage",
		label: "Lineage",
		icon: GitBranch,
		nodes: "agents · people · tasks",
		edges: "authored · spawned · delegated-for",
		// A trace is a record of what happened.
		writesFromGesture: false,
		panel: "agents",
		hasLayers: false,
		footer: "TRACE",
	},
};

// ─────────────────────────────────────────────────────────────────────────────
// Declared kinds — the boards that are not drawn
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A board is either **drawn** or **declared**, and `renders` is the trait that
 * says which ([boards-migration § 5](../../../../../docs/for-developers/building-engine/boards-migration.md)).
 *
 * The six above are drawn: elements at positions, a camera, layers, a layout
 * engine. These four are declared: panels from a closed set, bound to one
 * record, laid out by the spec ([CV12](../../../../../docs/for-developers/modules/explore/features/boards.md)).
 * They share the page host, the tab strip and the id shape; they share no
 * drawing code, which is why `renders` is the **only** thing the host branches
 * on.
 *
 * `kind` stays one flat axis — a declared row simply carries no `nodes`,
 * `edges`, `footer`, `hasLayers` or `writesFromGesture`, because a dashboard
 * has no legend and no gesture. That is § 5.1's table, as a union rather than
 * as six fields nobody fills in.
 */
export type DeclaredKind =
	| "runs"
	| "run"
	| "task_run"
	| "plan_runs"
	| "plan_versions"
	| "plan_arguments"
	| "plan_export"
	| "compare"
	| "skill"
	| "skill_usage"
	| "rule"
	| "world"
	| "guardrail"
	| "agent"
	| "models";

export type BoardKind = CanvasKind | DeclaredKind;

export interface DeclaredKindSpec {
	kind: DeclaredKind;
	renders: "dashboard";
	label: string;
	icon: ElementType;
	/** Which section opens it. */
	panel: string;
	/** What `subject_id` names — the record every panel binds to. */
	subject: string;
}

export const DECLARED_KINDS: Record<DeclaredKind, DeclaredKindSpec> = {
	// The journal drawn wide (SR70). Studio-only, like `agent`: it binds to
	// the Graph rather than to a record, so it offers no `Save report`.
	runs: {
		kind: "runs",
		renders: "dashboard",
		label: "Runs",
		icon: LayoutDashboard,
		// `Dashboard` on the Runs panel's header.
		panel: "runs",
		subject: "the graph's slug",
	},
	run: {
		kind: "run",
		renders: "dashboard",
		label: "Run",
		icon: LayoutDashboard,
		// `More` on a run in the Runs panel (SR13).
		panel: "runs",
		subject: "a root task_runs.id",
	},
	plan_runs: {
		kind: "plan_runs",
		renders: "dashboard",
		label: "Plan",
		icon: LayoutDashboard,
		// A plan in Library › Plans — its flow with per-task medians and its runs.
		panel: "library",
		subject: "a task_plans.id",
	},
	// `⋯` on the plan page (LB38) — records, not readings over a window, so
	// Studio-only like `runs`: none offers `Save report`.
	plan_versions: {
		kind: "plan_versions",
		renders: "dashboard",
		label: "Versions",
		icon: History,
		panel: "library",
		subject: "a task_plans.id",
	},
	plan_arguments: {
		kind: "plan_arguments",
		renders: "dashboard",
		label: "Arguments",
		icon: SlidersHorizontal,
		panel: "library",
		subject: "a task_plans.id",
	},
	plan_export: {
		kind: "plan_export",
		renders: "dashboard",
		label: "Export YAML",
		icon: FileCode,
		panel: "library",
		subject: "a task_plans.id",
	},
	task_run: {
		kind: "task_run",
		renders: "dashboard",
		label: "Step",
		icon: SquareActivity,
		// A task on the run dashboard's flow (SR18) — never a list row of its own.
		panel: "runs",
		subject: "one attempt of a task — a child task_runs.id",
	},
	// R3 · the same question under two worlds, and what B touched that A did not
	// (docs/for-developers/modules/govern/features/worlds.md WO4). **The diff is
	// the deliverable**, not the two answers — it is the only part a person
	// cannot reconstruct by reading both runs.
	//
	// Its subject is a **pair**, `<runA>:<runB>`, which the id parser already
	// handles: it splits on the *first* colon, so everything after `compare:` is
	// the subject. Nothing is simulated and no answer is synthesised from
	// another, so there is no record behind it to key on.
	compare: {
		kind: "compare",
		renders: "dashboard",
		label: "Compare",
		icon: GitCompareArrows,
		// `Compare…` in the Worlds section, or the run dashboard's lens band.
		panel: "govern",
		subject: 'two root task_runs.id joined by ":"',
	},
	// Skills (docs/for-developers/building-studio/skills-dashboards.md).
	// `skill` is the skill's page — it authors, like `agent` (SK36). `skill_usage`
	// names the same record and is **not** the same page: it is what happened
	// when the skill was offered, drawn from `task_runs` (SD2).
	skill: {
		kind: "skill",
		renders: "dashboard",
		label: "Skill",
		icon: Scale,
		// `Open` on the Skills section's selected row (SK37).
		panel: "skills",
		subject: "a skills.id",
	},
	// Addressed by the skill, not by a version: one read returns every version,
	// and the page's job is reading one count against the next — so a board per
	// version would be seven boards each holding a seventh of one reading (SD1).
	skill_usage: {
		kind: "skill_usage",
		renders: "dashboard",
		label: "Usage",
		icon: TrendingUp,
		// `Usage…` on the skill board, or `More` on the section's Usage tab.
		panel: "skills",
		subject: "a skills.id",
	},
	rule: {
		kind: "rule",
		renders: "dashboard",
		label: "Rule",
		icon: Quote,
		// `More` on the Rules section, drilled in (RU11).
		panel: "skills",
		subject: "a rules.id",
	},
	// A world and a guardrail are **one `lenses` row separated by `kind`**
	// (GV1), and one composer draws both. They are two kinds for the reason the
	// two names exist at all: a tab reading `Lens` would make a reader open it
	// to find out which of the two bounds they are looking at (WO15 · GR14).
	//
	// Neither tab is titled by `label`, either — the host names a lens board
	// after the lens, so a strip of four worlds reads as four worlds.
	world: {
		kind: "world",
		renders: "dashboard",
		label: "World",
		icon: Globe,
		// The Worlds drill-in opens it (WO15).
		panel: "govern",
		subject: "a lenses.id",
	},
	guardrail: {
		kind: "guardrail",
		renders: "dashboard",
		label: "Guardrail",
		icon: ShieldCheck,
		// The Guardrails drill-in opens it (GR14).
		panel: "govern",
		subject: "a lenses.id",
	},
	// The agent's one page — five tabs, the one declared page that edits
	// (AG23 · AG34). Titled with the agent's name, like a lens board, because a
	// strip of three tabs all reading `Agent` has to be clicked through to read.
	agent: {
		kind: "agent",
		renders: "dashboard",
		label: "Agent",
		icon: Bot,
		// `Open` on the Agents section; the list stays beside it.
		panel: "agents",
		subject: "an agents.id",
	},
	// Models, as one page (the-model-page.md MP1 · MP18). Studio-only and bound
	// to the Graph, like `runs`: the scope is a filter in the URL, never a
	// second board, so its tab reads `All models` or the model's name.
	models: {
		kind: "models",
		renders: "dashboard",
		label: "Models",
		icon: Boxes,
		// Switching the `leftNav` to Models opens it.
		panel: "model",
		subject: "the graph's slug",
	},
};

export type BoardKindSpec =
	| (CanvasKindSpec & { renders: "canvas" })
	| DeclaredKindSpec;

/** The whole axis, in one table — what the page host reads. */
export const BOARD_KINDS: Record<BoardKind, BoardKindSpec> = {
	...(Object.fromEntries(
		Object.entries(CANVAS_KINDS).map(([kind, spec]) => [
			kind,
			{ ...spec, renders: "canvas" as const },
		]),
	) as Record<CanvasKind, CanvasKindSpec & { renders: "canvas" }>),
	...DECLARED_KINDS,
};

/**
 * A page id, parsed ([boards-migration § 5.3](../../../../../../docs/for-developers/building-engine/boards-migration.md)).
 *
 * One rule, one parser: **`kind:id` is the live board, `kind:id@version` is a
 * frozen reading of it** — a version of a drawn board, a report of a declared
 * one. The `@` suffix is what says *frozen*; a `?frozen=true` beside the id
 * would be the same fact in two places, and the two would disagree the first
 * time a link was shared (B12).
 */
export interface BoardPageId {
	kind: BoardKind;
	/**
	 * What the page is *of*: the board row for a drawn kind — a drawing is the
	 * subject of itself — and the subject record for a declared one, which is
	 * the only address a live dashboard has, because it has no row (B9).
	 */
	id: string;
	/** Set when the page is a frozen reading. */
	versionId?: string;
}

/** `run:9f2c…` · `run:9f2c…@v2` — build one. */
export function boardPageId(
	kind: BoardKind,
	id: string,
	versionId?: string,
): string {
	return `${kind}:${id}${versionId ? `@${versionId}` : ""}`;
}

/**
 * The scheme before boards, kept for links people already have.
 *
 * `?page=canvas:<id>` was a data board under the one prefix every drawn board
 * shared. A bookmark that 404s is a worse answer than the page it meant, so it
 * is read as `data:<id>` and never written back.
 */
const LEGACY_PREFIX = "canvas:";

/** Read a page id, tolerating the legacy prefix. Null when it names no kind. */
export function parseBoardPageId(pageId: string): BoardPageId | null {
	const raw = pageId.startsWith(LEGACY_PREFIX)
		? `data:${pageId.slice(LEGACY_PREFIX.length)}`
		: pageId;
	const at = raw.indexOf(":");
	if (at < 0) return null;
	const kind = raw.slice(0, at);
	if (!(kind in BOARD_KINDS)) return null;
	const rest = raw.slice(at + 1);
	if (!rest) return null;
	// Split on the last `@` — an id never contains one, a version might.
	const mark = rest.lastIndexOf("@");
	return mark < 0
		? { kind: kind as BoardKind, id: rest }
		: {
				kind: kind as BoardKind,
				id: rest.slice(0, mark),
				versionId: rest.slice(mark + 1),
			};
}

/** The kind and subject behind a page id, for a kind that is declared. */
export function declaredPage(
	id: string,
): { kind: DeclaredKind; subjectId: string } | null {
	const page = parseBoardPageId(id);
	return page && page.kind in DECLARED_KINDS
		? { kind: page.kind as DeclaredKind, subjectId: page.id }
		: null;
}

/**
 * A declared board the tab strip is holding open.
 *
 * `subjectId` is the record every panel on it binds to — a run's id, one
 * attempt of a task, a skill, a rule. `runId` is the trace the three
 * trace-reading kinds share, which is why a step board carries it rather than
 * fetching its own (see-what-ran.md SR30 · SR36).
 *
 * **It is optional, because a skill has no run** (skills-dashboards.md SD3).
 * Carrying a placeholder one would put a fact on the record that nothing wrote
 * and something would eventually read.
 */
export interface OpenBoard {
	kind: DeclaredKind;
	subjectId: string;
	runId?: string;
	/**
	 * Set when the page is a **report** — a frozen reading of this board
	 * ([B12](../../../docs/for-developers/building-engine/boards-migration.md)).
	 * `kind:id` is live, `kind:id@version` is frozen: one parser, and the page
	 * id carries which you are looking at rather than a flag beside it.
	 */
	versionId?: string;
	/**
	 * A step board opened **cold** — a reload, or a link — while it reads which
	 * run it belongs to ([SR44](../../../docs/for-developers/modules/operate/features/see-what-ran.md)).
	 * The tab is there immediately and says it is loading; without the flag the
	 * page would draw [B17](../../../docs/for-developers/building-engine/boards-migration.md)'s
	 * refusal for the half-second before the answer arrives, which is a refusal
	 * that is not true yet.
	 */
	resolvingRun?: boolean;
	/** Open the run with this step inside it (SR72) — written as `&step=`. */
	stepId?: string;
}
