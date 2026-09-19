/**
 * The board `kind` registry — one flat axis, and the law that governs a click
 * on each ([boards-migration § 5](../../../../../../docs/for-developers/building-engine/boards-migration.md)).
 *
 * `kind` is **one column of nine values**. Whether a board is *drawn* or
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
 * Exactly **two** of the six drawn kinds write from a gesture, and both write
 * the same thing: an edge, because drawing it is the only natural way to say
 * it. Everything a user would call a "setting" — a name, an arg, a budget, an
 * assignee, a colour — is edited in the panel, on every kind, with no
 * exception. A new exception is argued in the feature file, never added in
 * code. A declared kind has no gesture at all.
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
	GitBranch,
	LayoutDashboard,
	ListTree,
	SquareActivity,
	Workflow,
} from "lucide-react";
import type { ElementType } from "react";

export type CanvasKind =
	| "data"
	| "model"
	| "plan"
	| "workflow"
	| "envelope"
	| "lineage";

/** What a click on a node does. */
export type ClickBehaviour =
	| "select" // highlights, and the panel's detail block states the fact
	| "navigate" // opens a different panel — the node is not of this panel's kind
	| "inert"; // nothing to show, and nowhere to go

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
		edges: "required order + ${steps.X.y} bindings",
		// Authoring a workflow is out of MVP; a canvas is not a loophole in a
		// threat model (docs/for-developers/modules/explore/features/selection-and-the-panel.md).
		writesFromGesture: false,
		// The library is the **Plans** drawer of the Tasks stack; a workflow is a
		// reusable TaskPlan, not a panel of its own (G30 · G33).
		panel: "tasks",
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

/** A kind the tabs bar does not know falls back to pan/zoom/select. */
export function specFor(kind: string | undefined): CanvasKindSpec {
	return CANVAS_KINDS[(kind ?? "data") as CanvasKind] ?? CANVAS_KINDS.data;
}

/**
 * What a click on one node should do.
 *
 * Five kinds are unambiguous, because every node is the same kind of thing as
 * the rows in the open panel. `lineage` breaks that — its nodes are agents,
 * people and tasks — so it is the one kind with a per-node branch (docs/for-developers/modules/agents/features/lineage.md):
 * an *agent* selects into the roster, a *task* navigates to Tasks, a *person*
 * is inert because MVP has no person surface.
 */
export function clickBehaviour(
	kind: CanvasKind,
	nodeKind?: string,
): ClickBehaviour {
	if (kind !== "lineage") return "select";
	if (nodeKind === "agent") return "select";
	if (nodeKind === "task") return "navigate";
	return "inert";
}

// ─────────────────────────────────────────────────────────────────────────────
// Declared kinds — the boards that are not drawn
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A board is either **drawn** or **declared**, and `renders` is the trait that
 * says which ([boards-migration § 5](../../../../../docs/for-developers/building-engine/boards-migration.md)).
 *
 * The six above are drawn: elements at positions, a camera, layers, a layout
 * engine. These two are declared: panels from a closed set, bound to one
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
export type DeclaredKind = "run" | "task_run" | "plan_runs";

export type BoardKind = CanvasKind | DeclaredKind;

export interface DeclaredKindSpec {
	kind: DeclaredKind;
	renders: "dashboard";
	label: string;
	icon: ElementType;
	/** Which drawer opens it. */
	panel: string;
	/** What `subject_id` names — the record every panel binds to. */
	subject: string;
}

export const DECLARED_KINDS: Record<DeclaredKind, DeclaredKindSpec> = {
	run: {
		kind: "run",
		renders: "dashboard",
		label: "Run",
		icon: LayoutDashboard,
		// `More` on a run in the Runs drawer (SR13).
		panel: "tasks",
		subject: "a root task_runs.id",
	},
	plan_runs: {
		kind: "plan_runs",
		renders: "dashboard",
		label: "Plan",
		icon: LayoutDashboard,
		// A plan in the Plans drawer — its flow with per-task medians and its runs.
		panel: "tasks",
		subject: "a task_plans.id",
	},
	task_run: {
		kind: "task_run",
		renders: "dashboard",
		label: "Step",
		icon: SquareActivity,
		// A task on the run dashboard's flow (SR18) — never a drawer row of its own.
		panel: "tasks",
		subject: "one attempt of a task — a child task_runs.id",
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

/** Whether a page id names a board that is drawn rather than declared. */
export function isDrawnPage(pageId: string): boolean {
	const page = parseBoardPageId(pageId);
	return page ? BOARD_KINDS[page.kind].renders === "canvas" : false;
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
