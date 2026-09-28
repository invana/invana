/**
 * The three readings `⋯` opens on a plan's page — Versions · Arguments ·
 * Export YAML ([LB38](../../../../../../../docs/for-developers/modules/workflows/features/the-library.md)).
 *
 * Pure: each builds one `DashboardSpec` from reads the page already made, and
 * `@invana/dashboard` draws it. They are records, not readings over a window,
 * so none carries a window switch or `Save report`.
 */

import type {
	PlanVersionDiff,
	TaskPlanCaller,
	TaskPlanSummary,
} from "@/pages/graphs-detail/features/plans/types";
import type { PlanArg } from "@/pages/graphs-detail/features/skills/types";
import type { DashboardSpec, PanelSpec } from "@invana/dashboard";

export const RECORD_ACTIONS = {
	/** The crumb naming the plan — back to its page. */
	openPlan: "open-plan",
	pickVersion: "pick-version",
	copy: "copy",
	download: "download",
} as const;

const header = (ref: string, reading: string) => ({
	crumbs: ["library", ref, reading],
	crumbActions: [undefined, RECORD_ACTIONS.openPlan],
});

/** A value as the plan holds it — a literal reads as itself, a binding as its marker. */
export const shown = (v: unknown): string =>
	v === undefined ? "—" : typeof v === "string" ? v : JSON.stringify(v);

// ── Versions ──────────────────────────────────────────────────────────────────

const fared = (v: TaskPlanSummary) =>
	v.runs
		? `${v.runs.toLocaleString()} run${v.runs === 1 ? "" : "s"}${
				v.served_rate == null
					? ""
					: ` · ${Math.round(v.served_rate * 100)}% served`
			}`
		: "never run";

function diffRows(diff: PlanVersionDiff) {
	return [
		...diff.added.map((k) => ({
			id: `+${k}`,
			change: "added",
			step: k,
			what: "—",
		})),
		...diff.removed.map((k) => ({
			id: `-${k}`,
			change: "removed",
			step: k,
			what: "—",
		})),
		...diff.changed.flatMap((c) =>
			c.fields.map((f) => ({
				id: `${c.step_key}.${f.field}`,
				change: "changed",
				step: c.step_key,
				what: `${f.field}: was ${shown(f.before)}, is now ${shown(f.after)}`,
			})),
		),
		...diff.moved.map((k) => ({
			id: `~${k}`,
			change: "moved",
			step: k,
			what: "its place in the order",
		})),
		...diff.arguments.map((a) => ({
			id: `arg.${a.name}`,
			change: `argument ${a.change}`,
			step: a.name,
			what:
				a.change === "added"
					? shown(a.after)
					: a.change === "removed"
						? `was ${shown(a.before)}`
						: `was ${shown(a.before)}, is now ${shown(a.after)}`,
		})),
		...diff.unchanged.map((k) => ({
			id: `=${k}`,
			change: "unchanged",
			step: k,
			what: "",
		})),
	];
}

export function planVersionsSpec(
	ref: string,
	versions: TaskPlanSummary[],
	diffs: Map<number, PlanVersionDiff>,
	picked: number,
): DashboardSpec {
	const newestFirst = [...versions].sort((a, b) => b.version - a.version);
	const diff = diffs.get(picked);
	const detail: PanelSpec = !diff
		? {
				kind: "text",
				options: { text: "Reading what changed…", tone: "muted" },
			}
		: diff.against_version == null
			? {
					kind: "text",
					title: `v${picked}`,
					options: {
						text: "The first version — there is nothing before it to compare against.",
						tone: "muted",
					},
				}
			: {
					kind: "table",
					title: `v${diff.against_version} → v${picked}`,
					aside: diff.summary,
					flush: true,
					options: {
						columns: [
							{ key: "change", label: "change", mono: false },
							{ key: "step", label: "step" },
							{ key: "what", label: "what", mono: false },
						],
						rows: diffRows(diff),
						rowKey: "id",
					},
				};
	return {
		title: `${ref} · versions`,
		header: {
			...header(ref, "versions"),
			chips: [
				{
					label: `${versions.length} version${versions.length === 1 ? "" : "s"}`,
				},
			],
		},
		rows: [
			{
				panels: [
					{
						kind: "table",
						title: "Every version, and how each fared",
						aside: "a published version is immutable — a change is a new one",
						flush: true,
						options: {
							columns: [
								{ key: "version", label: "version" },
								{ key: "changed", label: "what changed", mono: false },
								{ key: "fared", label: "how it fared", mono: false },
							],
							rows: newestFirst.map((v) => ({
								version: `v${v.version}`,
								changed: diffs.get(v.version)?.summary ?? "…",
								fared: fared(v),
							})),
							rowKey: "version",
							selectAction: RECORD_ACTIONS.pickVersion,
							selected: `v${picked}`,
						},
					},
				],
			},
			{ panels: [detail] },
		],
	};
}

// ── Arguments ─────────────────────────────────────────────────────────────────

export function planArgumentsSpec(
	ref: string,
	declared: Record<string, PlanArg>,
	callers: TaskPlanCaller[],
): DashboardSpec {
	const names = Object.keys(declared);
	const defaults = Object.fromEntries(
		names.map((n) => [n, shown(declared[n].default)]),
	);
	const rows: DashboardSpec["rows"] = [];
	if (!names.length) {
		rows.push({
			panels: [
				{
					kind: "text",
					title: "What this plan declares",
					options: {
						text: "Nothing. This plan declares no arguments, so a caller cannot tune it — every value is the plan's own.",
						callout: true,
					},
				},
			],
		});
	} else {
		rows.push(
			{
				panels: [
					{
						kind: "table",
						title: "What this plan declares",
						aside: "types are closed to str · int · bool",
						flush: true,
						options: {
							columns: [
								{ key: "name", label: "name" },
								{ key: "type", label: "type" },
								{ key: "default", label: "default" },
								{ key: "decides", label: "what it decides", mono: false },
							],
							rows: names.map((n) => ({
								name: n,
								type: declared[n].type,
								default:
									declared[n].default === undefined
										? "no default"
										: shown(declared[n].default),
								decides: declared[n].label ?? "—",
							})),
						},
					},
				],
			},
			{
				panels: [
					{
						kind: "table",
						title: "Who has tuned it, and to what",
						aside:
							"recorded on the calling plan — none of these edited this one",
						flush: true,
						options: {
							columns: [
								{ key: "caller", label: "caller", mono: false },
								...names.map((n) => ({ key: n, label: n })),
							],
							rows: [
								{ caller: "the plan's default", ...defaults },
								...callers.map((c) => ({
									caller: `${c.kind} · ${c.name}`,
									...defaults,
									...Object.fromEntries(
										names
											.filter((n) => n in c.args)
											.map((n) => [n, shown(c.args[n])]),
									),
								})),
								{ caller: "a plan run on its own", ...defaults },
							],
						},
					},
				],
			},
		);
	}
	return {
		title: `${ref} · arguments`,
		header: {
			...header(ref, "arguments"),
			chips: [{ label: `${names.length} declared` }],
		},
		rows,
	};
}

// ── Export YAML ───────────────────────────────────────────────────────────────

export function planExportSpec(
	ref: string,
	yaml: string | undefined,
): DashboardSpec {
	return {
		title: `${ref} · export`,
		header: {
			...header(ref, "export"),
			chips: [{ label: "read-only", variant: "outline" }],
			actions: yaml
				? [
						{ id: RECORD_ACTIONS.copy, label: "Copy" },
						{ id: RECORD_ACTIONS.download, label: "Download .yml" },
					]
				: undefined,
		},
		rows: [
			{
				panels: [
					yaml === undefined
						? {
								kind: "text",
								options: { text: "Reading the version…", tone: "muted" },
							}
						: {
								kind: "code",
								title: `${ref}.yml`,
								aside: "the version, as the engine holds it",
								flush: true,
								options: {
									value: yaml,
									language: "yaml",
									showLineNumbers: true,
								},
							},
				],
			},
		],
	};
}
