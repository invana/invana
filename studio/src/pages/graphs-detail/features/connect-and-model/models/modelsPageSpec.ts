/**
 * The model page as a dashboard document (the-model-page.md MP1–MP6).
 *
 * One header, then **Overview · Model · Database · Usage · Performance ·
 * Growth** with the `7 · 30 · 90 days` window on the right of the tab strip —
 * the plan page's layout, read at `All models` or one model. This file
 * composes; `ModelsPage` fetches and answers actions, and `@invana/dashboard`
 * draws. The tabs, their order and their columns never change with the scope
 * (MP2): what one scope lacks is a section, not a tab.
 */

import type { ModelFrame } from "@/pages/graphs-detail/features/connect-and-model/stitch/allModels";
import type {
	GraphModelResponse,
	GraphModelSummary,
	ModelLink,
	StagedSet,
	VersionSummary,
} from "@/types/models";
import type { TypeCountsResponse } from "@/types/traversal";
import type {
	ActionSpec,
	DashboardSpec,
	PanelSpec,
	RowSpec,
	StagedSpec,
	TabSpec,
} from "@invana/dashboard";
import type { ReactNode } from "react";
import {
	MODELS_TABS,
	MODELS_WINDOWS,
	type ModelsTab,
	type ModelsView,
	type ModelsWindow,
} from "./useModelsView";

export const MODELS_ACTIONS = {
	tab: "tab",
	window: "window",
	allModels: "scope-all",
	selectModel: "select-model",
	selectType: "select-type",
	newModel: "new-model",
	importModel: "import",
	more: "more",
	edit: "edit",
	exportModel: "export",
	publish: "publish",
	discardDraft: "discard-draft",
	discardOne: "discard-one",
} as const;

/** What `⋯` holds, per scope and state (the-model-page.md · The page). */
export const MODELS_MENU = {
	starters: "Starter models",
	introspect: "Introspect",
	rename: "Rename",
	exportModel: "Export",
	archive: "Archive",
	delete: "Delete",
} as const;
export type ModelsMenuItem = keyof typeof MODELS_MENU;

const TAB_LABEL: Record<ModelsTab, string> = {
	overview: "Overview",
	model: "Model",
	database: "Database",
	usage: "Usage",
	performance: "Performance",
	growth: "Growth",
};

const WINDOW_LABEL: Record<ModelsWindow, string> = {
	"7d": "7 days",
	"30d": "30 days",
	"90d": "90 days",
};
export const windowOf = (label: string): ModelsWindow | undefined =>
	MODELS_WINDOWS.find((w) => WINDOW_LABEL[w] === label);

/** A declaration and a mirror have no window (MP3). */
const UNWINDOWED: ModelsTab[] = ["model", "database"];
/** Nothing to count before a model is published (the-model-page.md seams). */
export const LOCKED_UNTIL_PUBLISHED: ModelsTab[] = [
	"usage",
	"performance",
	"growth",
];

export interface ModelsScope {
	model: GraphModelSummary;
	detail: GraphModelResponse | undefined;
	draft: VersionSummary | null;
	active: VersionSummary | null;
	/** The staged set while a draft is open. */
	staged: StagedSet | null;
	/** The active version was ever published — Archive, else Delete (MP7). */
	published: boolean;
}

export interface ModelsPageData {
	/** Authored models, archived ones left out. */
	models: GraphModelSummary[];
	/** Each model's active version's types — the Overview's counts. */
	frames: ModelFrame[];
	counts: TypeCountsResponse | undefined;
	links: ModelLink[];
	scope: ModelsScope | null;
	canWrite: boolean;
	loading: boolean;
}

/** What only the host can draw — the canvases, and the states it composes from kit parts. */
export interface ModelsPageSlots {
	modelTab: ReactNode;
	/** A tab whose read the engine does not serve yet (MP22). */
	notMeasured: (tab: ModelsTab) => ReactNode;
	/** The Overview when nothing is published. */
	emptyOverview: ReactNode;
}

type Panel = PanelSpec;

const nf = new Intl.NumberFormat();
const num = (v: number | null | undefined) => (v == null ? "—" : nf.format(v));

/** Records per type name, and per kind — `null` when the vendor could not count. */
function recordsOf(counts: TypeCountsResponse | undefined) {
	const nodes = new Map<string, number | null>();
	const edges = new Map<string, number | null>();
	for (const n of counts?.nodes ?? []) nodes.set(n.name, n.count ?? null);
	for (const e of counts?.edges ?? []) edges.set(e.name, e.count ?? null);
	return { nodes, edges, counted: !!counts?.counted };
}

function sum(values: (number | null | undefined)[]): number | null {
	if (values.some((v) => v == null)) return null;
	return values.reduce<number>((a, v) => a + (v ?? 0), 0);
}

/** A draft has no number until it is published. */
const draftLabel = (version: string | null) =>
	version ? `v${version} draft` : "draft";

const versionLabel = (m: GraphModelSummary) =>
	m.active_version ? `v${m.active_version.version} active` : "never published";

export function modelsPageSpec(
	data: ModelsPageData,
	view: ModelsView,
	slots: ModelsPageSlots,
): DashboardSpec {
	const anyPublished = data.models.some((m) => m.active_version);
	const locked = (tab: ModelsTab) =>
		!anyPublished && LOCKED_UNTIL_PUBLISHED.includes(tab);
	const tab: ModelsTab = locked(view.tab) ? "overview" : view.tab;

	const tabs: TabSpec[] = MODELS_TABS.map((id) => ({
		id,
		label: TAB_LABEL[id],
		locked: locked(id),
		rows:
			id !== tab
				? []
				: id === "overview"
					? overviewRows(data, slots)
					: id === "model"
						? [
								{
									fill: true,
									panels: [
										{
											kind: "text",
											options: { text: "" },
											render: slots.modelTab,
										},
									],
								},
							]
						: [notMeasuredRow(slots, id)],
	}));

	return {
		title: data.scope ? data.scope.model.name : "All models",
		header: header(data),
		staged: staged(data),
		tabs,
		tab,
		tabAction: MODELS_ACTIONS.tab,
		// The window is drawn only once there is something to read over it; on a
		// tab that ignores it, it is greyed rather than hidden (MP3).
		tabActions: anyPublished
			? [
					{
						id: MODELS_ACTIONS.window,
						options: MODELS_WINDOWS.map((w) => WINDOW_LABEL[w]),
						value: WINDOW_LABEL[view.window],
						disabled: UNWINDOWED.includes(tab),
					},
				]
			: undefined,
		rows: [],
	};
}

function header(data: ModelsPageData): DashboardSpec["header"] {
	const { scope, canWrite } = data;
	if (!scope) {
		const drafts = data.models.filter((m) => !m.active_version).length;
		const published = data.models.length - drafts;
		const stitches = data.links.filter((l) => l.status === "active").length;
		return {
			crumbs: ["All models"],
			chips: published
				? [
						{
							label: `${published} ${published === 1 ? "model" : "models"}`,
							variant: "outline",
						},
						{
							label: `${stitches} ${stitches === 1 ? "stitch" : "stitches"}`,
							variant: "outline",
						},
					]
				: [
						{
							label: `${drafts} ${drafts === 1 ? "draft" : "drafts"}`,
							variant: "outline",
						},
					],
			actions: canWrite
				? [
						{
							id: MODELS_ACTIONS.newModel,
							label: "New model",
							icon: "plus",
							variant: "default",
						},
						{
							id: MODELS_ACTIONS.importModel,
							label: "Import",
							icon: "upload",
							variant: "outline",
						},
						menu(["starters", "introspect"]),
					]
				: [],
		};
	}

	const { model, detail, draft, active, staged: set, published } = scope;
	const chips: NonNullable<NonNullable<DashboardSpec["header"]>["chips"]> = [];
	if (draft)
		chips.push({
			label: draft.version ? `v${draft.version} · draft` : "draft",
			tone: "info",
		});
	chips.push(
		active
			? { label: `v${active.version} · active`, variant: "outline" }
			: { label: "never published", variant: "outline" },
	);
	if (!canWrite) chips.push({ label: "read only", variant: "secondary" });

	const retire: ModelsMenuItem = published ? "archive" : "delete";
	const actions: ActionSpec[] = !canWrite
		? [
				{
					id: MODELS_ACTIONS.exportModel,
					label: "Export",
					variant: "outline",
					disabled: !active,
				},
			]
		: draft
			? [
					{
						id: MODELS_ACTIONS.publish,
						label: draft.version ? `Publish v${draft.version}` : "Publish",
						icon: "check",
						variant: "default",
						// The act says why rather than going quiet (the-model-page.md seams).
						disabled: !set?.can_commit,
					},
					{
						id: MODELS_ACTIONS.discardDraft,
						label: "Discard draft",
						variant: "outline",
					},
					menu(["rename", "exportModel", retire]),
				]
			: [
					{ id: MODELS_ACTIONS.edit, label: "Edit", variant: "default" },
					{
						id: MODELS_ACTIONS.exportModel,
						label: "Export",
						variant: "outline",
						disabled: !active,
					},
					menu(["rename", retire]),
				];

	return {
		crumbs: ["Models", model.name],
		crumbActions: [MODELS_ACTIONS.allModels, undefined],
		chips,
		actions,
		// One line; `More` for the rest (ME21).
		description: model.description || "No description.",
		details: [
			{
				label: "Validation",
				value: detail?.validation_mode ?? "—",
				mono: true,
			},
			{ label: "Origin", value: model.origin },
			{ label: "Status", value: published ? "published" : "never published" },
			{ label: "Updated", value: new Date(model.updated_at).toLocaleString() },
		],
	};
}

function menu(items: ModelsMenuItem[]): ActionSpec {
	return {
		id: MODELS_ACTIONS.more,
		// Not `More` — that is the description's own fold (ME21).
		label: "More actions",
		icon: "more",
		menu: true,
		options: items,
		optionLabels: Object.fromEntries(items.map((i) => [i, MODELS_MENU[i]])),
	};
}

function staged(data: ModelsPageData): StagedSpec | undefined {
	const set = data.scope?.staged;
	if (!data.scope?.draft || !set || set.count === 0) return undefined;
	return {
		items: set.changes.map((c) => ({
			id: c.id,
			op: c.op === "added" ? "add" : c.op === "removed" ? "remove" : "change",
			name: c.name,
			note: c.kind.replace("_", " "),
		})),
		discardAction: data.canWrite ? MODELS_ACTIONS.discardOne : undefined,
		discardAllAction: data.canWrite ? MODELS_ACTIONS.discardDraft : undefined,
		hint: data.canWrite && set.can_commit ? "⌘↵ publish" : undefined,
	};
}

// ── Overview ────────────────────────────────────────────────────────────────

function overviewRows(data: ModelsPageData, slots: ModelsPageSlots): RowSpec[] {
	if (data.loading)
		return [
			{
				panels: [
					{
						kind: "metrics",
						options: {
							tiles: ["Models", "Types", "Records"].map((label) => ({
								label,
								value: "…",
							})),
						},
					},
				],
			},
		];
	const anyPublished = data.models.some((m) => m.active_version);
	if (!anyPublished)
		return [
			{
				panels: [
					{ kind: "text", options: { text: "" }, render: slots.emptyOverview },
				],
			},
		];
	return data.scope ? overviewOne(data, data.scope) : overviewAll(data);
}

function overviewAll(data: ModelsPageData): RowSpec[] {
	const records = recordsOf(data.counts);
	const rows = data.models.map((m) => {
		const frame = data.frames.find((f) => f.modelId === m.id);
		const types =
			(frame?.nodeTypes.length ?? 0) + (frame?.edgeTypes.length ?? 0);
		const total = frame
			? sum([
					...frame.nodeTypes.map((t) => records.nodes.get(t.name)),
					...frame.edgeTypes.map((t) => records.edges.get(t.name)),
				])
			: null;
		return {
			id: m.id,
			model: m.name,
			version: versionLabel(m),
			types,
			records: records.counted ? num(total) : "—",
		};
	});
	const nodeTypes = data.frames.reduce((a, f) => a + f.nodeTypes.length, 0);
	const edgeTypes = data.frames.reduce((a, f) => a + f.edgeTypes.length, 0);
	const published = data.models.filter((m) => m.active_version).length;
	const drafts = data.models.length - published;
	const recordTotal = sum([
		...records.nodes.values(),
		...records.edges.values(),
	]);

	const tiles: Panel = {
		kind: "metrics",
		options: {
			tiles: [
				{
					label: "Models",
					value: String(data.models.length),
					caption: drafts
						? `${published} published · ${drafts} draft`
						: "all published",
				},
				{
					label: "Types",
					value: String(nodeTypes + edgeTypes),
					caption: `${nodeTypes} node · ${edgeTypes} edge`,
				},
				{
					label: "Records",
					value: records.counted ? num(recordTotal) : "—",
					caption: records.counted
						? "nodes and relationships"
						: "this database does not count",
				},
			],
		},
	};
	const table: Panel = {
		kind: "table",
		title: "Each model",
		aside: "click a model to read it alone",
		flush: true,
		options: {
			columns: [
				{ key: "model", label: "model" },
				{ key: "version", label: "version" },
				{ key: "types", label: "types", mono: true, align: "right" },
				{ key: "records", label: "records", mono: true, align: "right" },
			],
			rows,
			rowKey: "id",
			selectAction: MODELS_ACTIONS.selectModel,
		},
	};
	return [{ panels: [tiles] }, { panels: [table] }];
}

function overviewOne(data: ModelsPageData, scope: ModelsScope): RowSpec[] {
	const records = recordsOf(data.counts);
	const frame = data.frames.find((f) => f.modelId === scope.model.id);
	const nodeTypes = frame?.nodeTypes ?? [];
	const edgeTypes = frame?.edgeTypes ?? [];
	const rows = [
		...nodeTypes.map((t) => ({
			type: t.name,
			kind: "node",
			records: records.counted ? num(records.nodes.get(t.name)) : "—",
		})),
		...edgeTypes.map((t) => ({
			type: t.name,
			kind: "edge",
			records: records.counted ? num(records.edges.get(t.name)) : "—",
		})),
	];
	const total = sum(
		rows.map((r) =>
			r.kind === "node" ? records.nodes.get(r.type) : records.edges.get(r.type),
		),
	);

	const tiles: Panel = {
		kind: "metrics",
		options: {
			tiles: [
				{
					label: "Types",
					value: String(rows.length),
					caption: `${nodeTypes.length} node · ${edgeTypes.length} edge`,
				},
				{
					label: "Records",
					value: records.counted ? num(total) : "—",
					caption: scope.active
						? `v${scope.active.version} active`
						: "never published",
				},
				{
					label: "Staged",
					value: scope.draft ? String(scope.staged?.count ?? 0) : "—",
					caption: scope.draft
						? draftLabel(scope.draft.version)
						: "no draft open",
				},
			],
		},
	};
	const table: Panel = {
		kind: "table",
		title: "Each type",
		aside: "click a type to open it on the Model tab",
		flush: true,
		options: {
			columns: [
				{ key: "type", label: "type", mono: true },
				{ key: "kind", label: "kind" },
				{ key: "records", label: "records", mono: true, align: "right" },
			],
			rows,
			rowKey: "type",
			selectAction: MODELS_ACTIONS.selectType,
		},
	};
	return [{ panels: [tiles] }, { panels: [table] }];
}

function notMeasuredRow(slots: ModelsPageSlots, tab: ModelsTab): RowSpec {
	return {
		panels: [
			{ kind: "text", options: { text: "" }, render: slots.notMeasured(tab) },
		],
	};
}
