/**
 * One lens as a page — artboards `GovWorld` · `GovGuardrails`
 * ([W2 · G1](../../../../../../docs/for-developers/the-screens.md)).
 *
 * **One composer, both kinds.** A world and a guardrail are one `lenses` row
 * separated by `kind` ([GV1](../../../../../../docs/for-developers/modules/govern/spec.md)),
 * so a second composer would be the second enforcement path this module exists
 * not to have ([GR14](../../../../../../docs/for-developers/modules/govern/features/guardrails.md)).
 * `kind` changes what the page **says** — the crumb, the usage band, whether
 * `Edit` is offered — and nothing about how it is built.
 *
 * **This is the auditing reading, not the drawer widened**
 * ([WO15](../../../../../../docs/for-developers/modules/govern/features/worlds.md)).
 * The drawer is where a bound is picked, in a 420px column, with the run that
 * prompted the narrowing still open beside it. The board is what an auditor is
 * handed: what it narrows, how it has been used, every rule as an addressable
 * row, and the cast resolved against the effective guardrails. Only this one
 * can be **kept** — `Save report` freezes the resolved document
 * ([B6](../../../../../../docs/for-developers/building-engine/boards-migration.md)),
 * and *what was this world when the run happened* is the question a live drawer
 * cannot answer an hour later.
 *
 * Nothing here fetches and nothing here renders: a composer is a pure function
 * of one read, which is what lets `spec.json` show the document the page is.
 */

import {
	GOVERNED_LAYERS,
	layerSummary,
	rulesInLayer,
	since,
} from "@/pages/graphs-detail/features/govern/narrowing";
import {
	VIEW_ACTION,
	VIEW_DASHBOARD,
	VIEW_SPEC,
	count,
	omit,
	specPanel,
} from "@/pages/graphs-detail/shared/dashboardSpec";
import type { GovernLayer, GovernRule, Lens } from "@/types/govern";
import type { DashboardSpec, PanelSpec } from "@invana/dashboard";

/** Action ids this page answers. The spec carries the string; the page the behaviour. */
export const LENS_ACTIONS = {
	/** `Dashboard ¦ spec.json`. */
	view: VIEW_ACTION,
	/** `Edit` — puts the Govern drawer back on this lens, drilled in (WO16). */
	edit: "edit",
} as const;

/** The product's words for a layer — `graph_data` is a column name, not a label. */
const LAYER_LABEL: Record<GovernLayer, string> = {
	graph_data: "graph data",
	llm: "llm",
	third_party: "third party",
	cache: "cache",
	human: "human",
	agent: "agent",
};

export interface LensBoardView {
	/** `Dashboard` or `spec.json`. */
	view: string;
	/**
	 * Whether `Edit` is drawn at all. A guardrail's authoring controls are
	 * **absent** without the permission, never greyed
	 * ([GR12](../../../../../../docs/for-developers/modules/govern/features/guardrails.md)).
	 */
	mayEdit: boolean;
}

export function lensBoardSpec(
	lens: Lens,
	{ view, mayEdit }: LensBoardView,
): DashboardSpec {
	const guardrail = lens.kind === "guardrail";

	const header: DashboardSpec["header"] = {
		crumbs: [guardrail ? "Guardrails" : "Worlds", lens.display_name],
		chips: omit([
			{ label: lens.kind },
			{ label: `v${lens.version}` },
			guardrail
				? { label: lens.scope ?? "graph scope" }
				: lens.is_named
					? null
					: // An unnamed lens is attached to its run and private to whoever
						// ran it (WO1) — the board says so rather than leaving a reader
						// to wonder why it is in no list.
						{ label: "unnamed · private to you", tone: "muted" as const },
			guardrail ? { label: "audited", tone: "muted" as const } : null,
		]),
		actions: omit([
			{
				id: LENS_ACTIONS.view,
				options: [VIEW_DASHBOARD, VIEW_SPEC],
				value: view,
			},
			mayEdit
				? { id: LENS_ACTIONS.edit, label: "Edit", variant: "outline" as const }
				: null,
		]),
	};

	const spec: DashboardSpec = {
		title: lens.display_name,
		header,
		rows: bands(lens),
	};

	return view === VIEW_SPEC
		? { ...spec, rows: [{ panels: [specPanel(spec)] }] }
		: spec;
}

/** What one rule narrows, in the words the rule row uses. */
function narrows(rule: GovernRule): string {
	const bits: string[] = [];
	const select = rule.select;
	if (select?.time) {
		const { axis, from, to } = select.time;
		bits.push(`time ${from ?? "…"} → ${to ?? "…"} · axis ${axis}`);
	}
	if (select?.geo) bits.push(`geo ${select.geo.in.join(" · ")}`);
	for (const [dim, values] of Object.entries(select?.dims ?? {})) {
		bits.push(`${dim} ${values.join(" · ")}`);
	}
	const excluded = rule.properties?.exclude ?? [];
	if (excluded.length) bits.push(`excludes ${excluded.join(" · ")}`);
	for (const [key, value] of Object.entries(rule.options ?? {})) {
		bits.push(`${key} ${String(value)}`);
	}
	return bits.join(" · ");
}

function bands(lens: Lens): DashboardSpec["rows"] {
	const guardrail = lens.kind === "guardrail";
	const rules = lens.rules ?? [];
	const closed = lens.closed_layers ?? [];
	const usage = lens.usage ?? null;
	const cast = lens.cast ?? {};
	const resolved = lens.cast_resolved ?? [];
	const denied = resolved.filter((row) => row.address && !row.allowed);

	return omit<DashboardSpec["rows"][number]>([
		{
			panels: [
				{
					kind: "metrics",
					options: {
						tiles: omit([
							{
								label: "Rules",
								value: count(rules.length),
								caption: `${count(rules.filter((r) => r.allow).length)} allow · ${count(
									rules.filter((r) => !r.allow).length,
								)} deny`,
							},
							{
								label: "Closed layers",
								value: closed.length
									? closed.map((l) => LAYER_LABEL[l]).join(" · ")
									: "none",
								// A layer named here admits only what its rules allow; one
								// absent is permitted whole (GV23).
								caption: closed.length
									? "admit only what a rule allows"
									: "every layer permitted whole",
							},
							// **A guardrail is not picked, so it has no pick count**
							// (GR14). Counting the runs that chose it would print `0`
							// on the one bound that is on every run.
							guardrail
								? {
										label: "In force",
										value: "every run",
										caption: "a guardrail is not a world you pick",
									}
								: {
										label: "Runs",
										value: count(usage?.runs ?? 0),
										caption: usage?.runs
											? "asked under this world"
											: "nobody has asked under it yet",
									},
							guardrail
								? null
								: {
										label: "Last used",
										value: since(usage?.last_used_at) ?? "—",
										caption: usage?.actor_ids?.length
											? `${count(usage.actor_ids.length)} people`
											: "no run has picked it",
									},
						]),
					},
				} as PanelSpec,
			],
		},
		{
			panels: [
				{
					kind: "properties",
					title: "The record",
					aside: "one object — what an auditor is handed",
					options: {
						rows: omit([
							{ label: "kind", value: lens.kind },
							{ label: "name", value: lens.name ?? "— unnamed" },
							lens.key ? { label: "key", value: lens.key, mono: true } : null,
							{ label: "scope", value: lens.scope ?? "graph" },
							// Null is *now*, and saying so is the point: a blank would
							// leave a reader wondering whether nothing is set or nothing
							// loaded.
							{
								label: "as_of",
								value: lens.as_of
									? `${lens.as_of} — which versions and stitches are in view`
									: "now",
								mono: Boolean(lens.as_of),
							},
							{ label: "version", value: `v${lens.version}`, mono: true },
							{ label: "created", value: lens.created_at.slice(0, 10) },
							{ label: "updated", value: lens.updated_at.slice(0, 10) },
							lens.created_in_run_id
								? {
										label: "created in run",
										value: lens.created_in_run_id,
										mono: true,
									}
								: null,
						]),
					},
				} as PanelSpec,
				{
					kind: "properties",
					title: "The five layers",
					aside: "what each one says about itself",
					options: {
						rows: GOVERNED_LAYERS.map((layer) => ({
							label: LAYER_LABEL[layer],
							value: layerSummary(lens, layer),
						})),
					},
				} as PanelSpec,
			],
		},
		// One table per layer that has a rule. A layer with none is already
		// stated above as *permitted whole* or *closed*, and an empty table
		// under its name would read as a bound nobody wrote.
		...GOVERNED_LAYERS.map((layer) => {
			const inLayer = rulesInLayer(lens, layer);
			if (!inLayer.length) return null;
			return {
				panels: [
					{
						kind: "table",
						title: LAYER_LABEL[layer],
						aside: layerSummary(lens, layer),
						flush: true,
						options: {
							columns: [
								{ key: "match", label: "address", mono: true },
								{ key: "rule", label: "" },
								{ key: "narrows", label: "narrows" },
								{ key: "egress", label: "may send" },
							],
							rows: inLayer.map((rule) => ({
								match: rule.match,
								rule: rule.allow ? "allow" : "deny",
								narrows: narrows(rule),
								// The default is `[]` — nothing. An unmatched destination
								// sends nothing at all (GV12), so a blank here is a fact.
								egress: (rule.egress?.may_send ?? []).join(" · "),
							})),
						},
					} as PanelSpec,
				],
			};
		}),
		Object.keys(cast).length || resolved.length
			? {
					panels: [
						{
							kind: "table",
							title: "Cast",
							aside: resolved.length
								? "resolved, then checked against the effective rules"
								: "what this lens casts — not yet what a run would get",
							flush: true,
							options: {
								columns: [
									{ key: "role", label: "role" },
									{ key: "address", label: "resolves to", mono: true },
									{ key: "source", label: "from" },
									{ key: "allowed", label: "allowed" },
									{ key: "rule", label: "by", mono: true },
								],
								// The resolution is the richer read and supersedes the
								// cast it was computed from; without it the four roles
								// this lens names are still worth printing.
								rows: resolved.length
									? resolved.map((row) => ({
											role: row.role,
											address: row.address ?? "— the shipped default",
											source: row.source,
											allowed: row.allowed ? "yes" : "no",
											rule: row.rule_matched ?? "",
										}))
									: Object.entries(cast).map(([role, address]) => ({
											role,
											address: address ?? "",
											source: "lens",
											allowed: "",
											rule: "",
										})),
							},
						} as PanelSpec,
					],
				}
			: null,
		// R4's seam, on the page where the person who can fix it is reading:
		// the cast resolves to a model the bound above it denies, so the run
		// does not open.
		...denied.map((row) => ({
			panels: [
				{
					kind: "text",
					title: `${row.role} — this run cannot open`,
					aside: row.rule_matched ?? undefined,
					options: {
						tone: "error" as const,
						callout: true,
						text:
							row.refusal ??
							`The cast names ${row.address} for ${row.role}, and the effective rules deny it.`,
					},
				} as PanelSpec,
			],
		})),
		{
			panels: [
				{
					kind: "text",
					options: {
						tone: "muted" as const,
						text: guardrail
							? "In force on every run in this Graph — a guardrail is not a world you pick. Every world narrows within it, and a world that tries to widen it is refused at save, naming the rule. Runs already in flight keep the lens they froze."
							: "A world narrows within the guardrails; it can never widen them. It is validated against them when it is saved, not when it is run — so a world that cannot legally run is one nobody can save and then wonder about.",
					},
				} as PanelSpec,
			],
		},
	]);
}
