/**
 * The model page as a board document (the-model-page.md).
 *
 * One header, then **Overview · Model · Database · Usage · Performance ·
 * Growth** with the `7 · 30 · 90 days` window on the right of the tab strip —
 * the plan page's layout, read at `All models` or one model. This file
 * composes; `ModelsPage` fetches and answers actions, and `@invana/boards`
 * draws. The tabs, their order and their columns never change with the scope:
 * what one scope lacks is a section, not a tab.
 */

import type {
	ActionSpec,
	BoardSpec,
	PanelSpec,
	RowSpec,
	StagedSpec,
	TabSpec,
} from "@invana/boards";
import type { ReactNode } from "react";
import type { TypeCountsResponse } from "@/pages/graphs-detail/features/explorer";
import type { ModelFrame } from "@/pages/graphs-detail/features/models/stitch/allModels";
import type {
	GraphModelResponse,
	GraphModelSummary,
	Insights,
	ModelLink,
	PhysicalSchema,
	StagedSet,
	VersionSummary,
} from "@/pages/graphs-detail/features/models/types";
import {
	type DatabaseRowsOptions,
	databaseRows,
	driftCount,
} from "./databaseRows";
import { type GrowthRowsOptions, growthRows } from "./growthRows";
import { fmtMs, fmtPct } from "./insightParts";
import { attentionPanel, callersPanel, p95Panel } from "./overviewParts";
import {
	type PerformanceRowsOptions,
	performanceRows,
} from "./performanceRows";
import { usageRows } from "./usageRows";
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
const MODELS_MENU = {
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

/** A declaration and a mirror have no window. */
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
	/** The active version was ever published — Archive, else Delete. */
	published: boolean;
}

export interface ModelsPageData {
	/** Authored models, archived ones left out. */
	models: GraphModelSummary[];
	/** Each model's active version's types — the Overview's counts. */
	frames: ModelFrame[];
	counts: TypeCountsResponse | undefined;
	/** Stitches between active versions; undefined while they load. */
	links: ModelLink[] | undefined;
	/** The mirror, drift marked, at the page's scope. */
	physical: PhysicalSchema | undefined;
	physicalLoading: boolean;
	/** The measured tabs over the window; a `null` slice is not measured. */
	insights: Insights | undefined;
	insightsLoading: boolean;
	scope: ModelsScope | null;
	canWrite: boolean;
	loading: boolean;
}

/** What only the host can draw — the canvases, and the states it composes from kit parts. */
export interface ModelsPageSlots {
	modelTab: ReactNode;
	/** A tab whose read the engine does not serve yet. */
	notMeasured: (tab: ModelsTab) => ReactNode;
	/** The Overview when nothing is published. */
	emptyOverview: ReactNode;
	database: Omit<DatabaseRowsOptions, "scopeName">;
	growth: Pick<
		GrowthRowsOptions,
		"canWrite" | "onBringDataIn" | "onSeeTypes" | "onOpenRun"
	>;
	performance: Pick<PerformanceRowsOptions, "selected" | "onSelect">;
	/** A Needs-attention row's link to its tab. */
	onTab: (tab: ModelsTab) => void;
}

/** One tab's rows — only the open tab is composed. */
function tabRows(
	id: ModelsTab,
	data: ModelsPageData,
	view: ModelsView,
	slots: ModelsPageSlots,
): RowSpec[] {
	const scopeName = data.scope?.model.name ?? null;
	const days = Number.parseInt(view.window, 10);
	const measured = (slice: keyof Insights) =>
		data.insightsLoading || (data.insights?.[slice] ?? null) !== null;
	switch (id) {
		case "overview":
			return overviewRows(data, view, slots);
		case "model":
			return [
				{
					fill: true,
					panels: [
						{ kind: "text", options: { text: "" }, render: slots.modelTab },
					],
				},
			];
		case "database":
			return databaseRows(data.physical, data.physicalLoading, {
				...slots.database,
				scopeName,
			});
		case "growth":
			return measured("growth")
				? growthRows(data.insights?.growth, data.insightsLoading, {
						...slots.growth,
						scopeName,
						scopeVersion: data.scope?.active
							? `v${data.scope.active.version}`
							: null,
						hueOf: (m) => data.frames.find((f) => f.modelId === m)?.hue,
						days,
					})
				: [notMeasuredRow(slots, id)];
		case "usage":
			return measured("usage")
				? usageRows(data.insights?.usage, data.insightsLoading, {
						scopeName,
						days,
					})
				: [notMeasuredRow(slots, id)];
		case "performance":
			return measured("performance")
				? performanceRows(
						data.insights?.performance,
						data.insights?.overview?.graph_p95 ?? null,
						data.insightsLoading,
						{
							...slots.performance,
							scopeName,
							days,
							marks: data.insights?.growth?.marks ?? [],
						},
					)
				: [notMeasuredRow(slots, id)];
	}
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
): BoardSpec {
	const anyPublished = data.models.some((m) => m.active_version);
	const locked = (tab: ModelsTab) =>
		!anyPublished && LOCKED_UNTIL_PUBLISHED.includes(tab);
	const tab: ModelsTab = locked(view.tab) ? "overview" : view.tab;

	const tabs: TabSpec[] = MODELS_TABS.map((id) => ({
		id,
		label: TAB_LABEL[id],
		locked: locked(id),
		// One model's canvas is the whole tab, so it meets the tab strip; All
		// models keeps the padding for the union card beside it.
		flush: id === "model" && data.scope !== null,
		rows: id !== tab ? [] : tabRows(id, data, view, slots),
	}));

	return {
		title: data.scope ? data.scope.model.name : "All models",
		header: header(data),
		staged: staged(data),
		tabs,
		tab,
		tabAction: MODELS_ACTIONS.tab,
		// The window is drawn only once there is something to read over it; on a
		// tab that ignores it, it is greyed rather than hidden.
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

function header(data: ModelsPageData): BoardSpec["header"] {
	const { scope, canWrite } = data;
	if (!scope) {
		const drafts = data.models.filter((m) => !m.active_version).length;
		const published = data.models.length - drafts;
		// Unknown reads "—", never 0: nothing loaded yet is not nothing stitched.
		const stitches = data.links?.filter((l) => l.status === "active").length;
		return {
			crumbs: ["All models"],
			chips: published
				? [
						{
							label: `${published} ${published === 1 ? "model" : "models"}`,
							variant: "outline",
						},
						{
							label: `${stitches ?? "—"} ${stitches === 1 ? "stitch" : "stitches"}`,
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
	const chips: NonNullable<NonNullable<BoardSpec["header"]>["chips"]> = [];
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
		// One line; `More` for the rest.
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
		// Not `More` — that is the description's own fold.
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

function overviewRows(
	data: ModelsPageData,
	view: ModelsView,
	slots: ModelsPageSlots,
): RowSpec[] {
	if (data.loading)
		return [
			{
				panels: [
					{
						kind: "grid",
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
	return data.scope
		? overviewOne(data, data.scope, view, slots)
		: overviewAll(data, view, slots);
}

function overviewAll(
	data: ModelsPageData,
	view: ModelsView,
	slots: ModelsPageSlots,
): RowSpec[] {
	const records = recordsOf(data.counts);
	const measured = measuredOf(data.insights);
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
			...measured(m.id, false),
			drift: modelDrift(data.physical, m.name),
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
		kind: "grid",
		options: {
			tiles: [
				{
					label: "Models",
					value: String(data.models.length),
					delta: drafts
						? `${published} published · ${drafts} draft`
						: "all published",
				},
				{
					label: "Types",
					value: String(nodeTypes + edgeTypes),
					delta: `${nodeTypes} node · ${edgeTypes} edge`,
				},
				{
					label: "Records",
					value: records.counted ? num(recordTotal) : "—",
					delta: records.counted
						? (grewBy(data.insights) ?? "nodes and relationships")
						: "this database does not count",
				},
				...queryTiles(data.insights, false),
				...driftTile(data.physical),
			],
		},
	};
	const table: Panel = {
		// The panel's id is the action a pick answers — see `routedAction`.
		id: MODELS_ACTIONS.selectModel,
		kind: "table",
		title: "Each model",
		aside: "click a model to read it alone",
		flush: true,
		options: {
			columns: [
				{ key: "model", label: "model", mono: true },
				{ key: "version", label: "version", mono: true },
				{ key: "types", label: "types", mono: true, align: "right" },
				{ key: "records", label: "records", mono: true, align: "right" },
				...MEASURED_COLUMNS,
				{ key: "drift", label: "drift", mono: true },
			],
			rows,
			rowKey: "id",
		},
	};
	return [
		{ panels: [tiles] },
		{ panels: [table] },
		...lowerRow(data, view, slots, false),
	];
}

function overviewOne(
	data: ModelsPageData,
	scope: ModelsScope,
	view: ModelsView,
	slots: ModelsPageSlots,
): RowSpec[] {
	const measured = measuredOf(data.insights);
	const records = recordsOf(data.counts);
	const frame = data.frames.find((f) => f.modelId === scope.model.id);
	const nodeTypes = frame?.nodeTypes ?? [];
	const edgeTypes = frame?.edgeTypes ?? [];
	const changed = new Map(
		(data.insights?.growth?.rows ?? []).map((r) => [r.key, r.change]),
	);
	const change = (kind: string, name: string) => {
		const v = changed.get(`${kind}:${name}`);
		return v ? `${v > 0 ? "+" : "−"}${nf.format(Math.abs(v))}` : "—";
	};
	const rows = [
		...nodeTypes.map((t) => ({
			type: t.name,
			kind: "node",
			records: records.counted ? num(records.nodes.get(t.name)) : "—",
			change: change("node", t.name),
			...measured(`node:${t.name}`, true),
		})),
		...edgeTypes.map((t) => ({
			type: t.name,
			kind: "edge",
			records: records.counted ? num(records.edges.get(t.name)) : "—",
			change: change("edge", t.name),
			...measured(`edge:${t.name}`, true),
		})),
	];
	const total = sum(
		rows.map((r) =>
			r.kind === "node" ? records.nodes.get(r.type) : records.edges.get(r.type),
		),
	);

	const tiles: Panel = {
		kind: "grid",
		options: {
			tiles: [
				{
					label: "Types",
					value: String(rows.length),
					delta: `${nodeTypes.length} node · ${edgeTypes.length} edge`,
				},
				{
					label: "Records",
					value: records.counted ? num(total) : "—",
					delta:
						grewBy(data.insights) ??
						(scope.active
							? `v${scope.active.version} active`
							: "never published"),
				},
				...queryTiles(data.insights, true),
				...driftTile(data.physical),
				{
					label: "Staged",
					value: scope.draft ? String(scope.staged?.count ?? 0) : "—",
					delta: scope.draft
						? draftLabel(scope.draft.version)
						: "no draft open",
				},
			],
		},
	};
	const table: Panel = {
		// The panel's id is the action a pick answers — see `routedAction`.
		id: MODELS_ACTIONS.selectType,
		kind: "table",
		title: "Each type",
		aside: "click a type to open it on the Model tab",
		flush: true,
		options: {
			columns: [
				{ key: "type", label: "type", mono: true },
				{ key: "kind", label: "kind", mono: true },
				{ key: "records", label: "records", mono: true, align: "right" },
				{ key: "change", label: "change", mono: true, align: "right" },
				...MEASURED_COLUMNS,
			],
			rows,
			rowKey: "type",
		},
	};
	return [
		{ panels: [tiles] },
		{ panels: [table] },
		...lowerRow(data, view, slots, true),
	];
}

const MEASURED_COLUMNS = [
	{
		key: "share",
		label: "share of queries",
		mono: true,
		align: "right" as const,
	},
	{ key: "p95", label: "p95", mono: true, align: "right" as const },
	{ key: "signal", label: "signal", mono: true },
];

const SIGNAL_TEXT: Record<string, string> = {
	hot_and_slow: "▲ hot and slow",
	hot: "▲ hot",
	supernode: "◆ supernode",
	unused: "○ unused",
	empty: "○ empty",
	cold: "○ cold",
};

/** A row's share, p95 and signals — `—` until the log has measured them. */
function measuredOf(insights: Insights | undefined) {
	const rows = new Map((insights?.overview?.rows ?? []).map((r) => [r.key, r]));
	return (key: string, one: boolean) => {
		const r = rows.get(key);
		if (!insights?.overview || !r) return { share: "—", p95: "—", signal: "—" };
		return {
			share: fmtPct(r.share),
			p95: fmtMs(r.p95),
			signal:
				r.signals
					.map((s) =>
						one
							? SIGNAL_TEXT[s.signal]
							: `${SIGNAL_TEXT[s.signal]} ${s.subject.split(".").pop()}`,
					)
					.join(" · ") || "—",
		};
	};
}

/** Queries a day and p95 — left out, never zero, until the log has any. */
function queryTiles(insights: Insights | undefined, one: boolean) {
	const o = insights?.overview;
	if (!o) return [];
	return [
		{
			label: "Queries a day",
			// Under ten a day, the tenth is the reading — `0.1`, never a rounded `0`.
			value:
				o.queries_a_day < 10
					? o.queries_a_day.toFixed(1)
					: fmtNum(o.queries_a_day),
			delta: one
				? "touching this model"
				: `over ${insights?.window.replace("d", " days")}`,
		},
		{
			label: "p95",
			value: fmtMs(o.p95),
			delta: one
				? `the Graph's is ${fmtMs(o.graph_p95)}`
				: `p50 ${fmtMs(o.p50)}`,
			tone:
				one && o.p95 != null && o.graph_p95 != null && o.p95 > o.graph_p95
					? ("warn" as const)
					: undefined,
		},
	];
}

/** Needs attention, beside queries by caller (All) or p95 a day (one). */
function lowerRow(
	data: ModelsPageData,
	view: ModelsView,
	slots: ModelsPageSlots,
	one: boolean,
): RowSpec[] {
	const o = data.insights?.overview;
	if (!o) return [];
	const days = Number.parseInt(view.window, 10);
	return [
		{
			panels: [
				attentionPanel(o, data.physical, one, days, slots.onTab),
				one
					? p95Panel(o, data.insights?.growth?.marks ?? [])
					: callersPanel(o, days),
			],
		},
	];
}

const fmtNum = (v: number) => nf.format(Math.round(v));

/** `↑ 6.2% in 30 days` — the Records tile's caption once Growth has counted. */
function grewBy(insights: Insights | undefined): string | null {
	const growth = insights?.growth;
	if (!insights || !growth?.counted) return null;
	const start = growth.rows.reduce((a, r) => a + (r.start ?? 0), 0);
	const now = growth.rows.reduce((a, r) => a + (r.now ?? 0), 0);
	const days = Number.parseInt(insights.window, 10);
	// Nothing counted before the window: a rise from nothing is not growth.
	if (!growth.rows.some((r) => r.start != null)) return null;
	if (now === start) return `unchanged in ${days} days`;
	const by = start
		? `${Math.abs(((now - start) / start) * 100).toFixed(1)}%`
		: nf.format(Math.abs(now - start));
	return `${now > start ? "↑" : "↓"} ${by} in ${days} days`;
}

/** Rows that disagree with the models, left out until a mirror exists. */
function driftTile(physical: PhysicalSchema | undefined) {
	const drift = driftCount(physical);
	if (!drift) return [];
	return [
		{
			label: "Drift",
			value: String(drift.total),
			delta: drift.total
				? `${drift.labels} ${drift.labels === 1 ? "type" : "types"} · ${drift.rules} ${drift.rules === 1 ? "index or constraint" : "indexes and constraints"}`
				: "in sync with the database",
			tone: drift.total ? ("warn" as const) : undefined,
		},
	];
}

/** `in sync`, or how many of the model's rows the database lacks. */
function modelDrift(physical: PhysicalSchema | undefined, model: string) {
	if (!physical?.captured_at) return "—";
	const off = [
		...physical.labels,
		...physical.relationship_types,
		...physical.indexes,
		...physical.constraints,
	].filter((r) => r.models.includes(model) && r.drift !== "in_both").length;
	return off ? `◐ ${off} model only` : "● in sync";
}

function notMeasuredRow(slots: ModelsPageSlots, tab: ModelsTab): RowSpec {
	return {
		panels: [
			{ kind: "text", options: { text: "" }, render: slots.notMeasured(tab) },
		],
	};
}
