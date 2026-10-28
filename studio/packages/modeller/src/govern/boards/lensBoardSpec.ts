/**
 * One world as a page — the auditor's reading of it.
 *
 * The Worlds panel is where a world is picked and edited, in a 420px column;
 * this board is what an auditor is handed: how far the world narrows, whether
 * it is in force, how it has been used, its five layers with their state, and
 * the cast — the agents whose runs asked under it, read from the runs, not
 * from the world's `cast`.
 *
 * | Band | What it reads |
 * |---|---|
 * | Head | `Worlds › <world>` · `last used …` · `world` · `used in N runs` · *Edit* |
 * | Tiles | Rules (`allow_rules` · `deny_rules`) · Closed layers · In force · Runs (`usage.runs_30d`) · Last used |
 * | Five layers | each governed layer: what it allows, and `sliced` · `allowed` · `closed` · `denied` |
 * | Cast | `usage.by_agent` — agent · runs · last; a world nobody asked under says so |
 *
 * Every number is the engine's. A guardrail has no board: it is a property
 * rule read on the Guardrails page.
 *
 * Nothing here fetches and nothing here renders: a composer is a pure function
 * of one read.
 */

import type { BoardSpec, PanelSpec } from "@invana/boards";
import type { GovernLayer, GovernRule, Lens } from "@invana-studio/core";
import { count, omit } from "@invana-studio/shell";
import { GOVERNED_LAYERS, rulesInLayer, since } from "../narrowing";

/** Action ids this page answers. The spec carries the string; the page the behaviour. */
export const LENS_ACTIONS = {
	/** `Edit` — puts the Govern panel back on this world, in its editor. */
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

/** A layer's state on the board. */
type LayerState = "sliced" | "allowed" | "closed" | "denied";

const STATE_TONE: Record<LayerState, "info" | "success" | "warning" | "error"> =
	{
		sliced: "info",
		allowed: "success",
		closed: "warning",
		denied: "error",
	};

export interface LensBoardView {
	/** Whether `Edit` is enabled — it is drawn either way, disabled without the role. */
	mayEdit: boolean;
	/** The Graph's name, for *inside <Graph> guardrails*. */
	graphName: string;
}

function isSliced(rule: GovernRule): boolean {
	const s = rule.select;
	return Boolean(
		s?.time ||
			s?.geo ||
			Object.keys(s?.dims ?? {}).length ||
			rule.properties?.exclude?.length,
	);
}

/** What a rule's address names, without its layer. */
function target(rule: GovernRule): string {
	const parts = rule.match.split("/");
	return parts.length > 1 ? parts.slice(1).join("/") : rule.match;
}

/** How one allow rule narrows, as a short phrase. */
function narrows(rule: GovernRule): string[] {
	const bits: string[] = [];
	const select = rule.select;
	if (select?.time) {
		const { from, to } = select.time;
		bits.push(`${from ?? "…"} – ${to ?? "…"}`);
	}
	if (select?.geo) bits.push(select.geo.in.join(" "));
	for (const values of Object.values(select?.dims ?? {})) {
		bits.push(values.join(" "));
	}
	const excluded = rule.properties?.exclude ?? [];
	if (excluded.length) bits.push(`without ${excluded.join(" · ")}`);
	return bits;
}

/** One layer: what it allows, in words, and its state. */
function layerReading(
	lens: Lens,
	layer: GovernLayer,
): { allows: string; state: LayerState } {
	const rules = rulesInLayer(lens, layer);
	const closed = (lens.closed_layers ?? []).includes(layer);
	const allows = rules.filter((r) => r.allow);
	const denies = rules.filter((r) => !r.allow);

	if (!allows.length) {
		if (closed) return { allows: "nothing is allowed in", state: "closed" };
		if (denies.length) {
			return {
				allows: `all but ${denies.map(target).join(" · ")}`,
				state: "denied",
			};
		}
		return { allows: "permitted whole", state: "allowed" };
	}

	const named = allows.map((r) => [target(r), ...narrows(r)].join(" · "));
	const words = closed
		? `${named.join(" · ")} only`
		: `${named.join(" · ")} · the rest permitted whole`;
	return {
		allows: denies.length
			? `${words} · denies ${denies.map(target).join(" · ")}`
			: words,
		state: rules.some(isSliced) ? "sliced" : "allowed",
	};
}

export function lensBoardSpec(
	lens: Lens,
	{ mayEdit, graphName }: LensBoardView,
): BoardSpec {
	const usage = lens.usage ?? null;
	const lastUsed = since(usage?.last_used_at);

	const header: BoardSpec["header"] = {
		crumbs: ["Worlds", lens.display_name],
		chips: omit([
			{
				label: lastUsed ? `last used ${lastUsed}` : "never used",
				tone: "muted" as const,
			},
			{ label: "world", variant: "outline" as const },
			{
				label: `used in ${count(usage?.runs ?? 0)} runs`,
				variant: "outline" as const,
			},
			lens.is_named
				? null
				: // An unnamed world is attached to its run and private to whoever
					// ran it — the board says so rather than leaving a reader to
					// wonder why it is in no list.
					{ label: "unnamed · private to you", tone: "muted" as const },
		]),
		actions: [
			{
				id: LENS_ACTIONS.edit,
				label: "Edit",
				disabled: !mayEdit,
			},
		],
	};

	return {
		title: lens.display_name,
		header,
		rows: [
			{ panels: [tiles(lens, graphName)] },
			{ panels: [layersPanel(lens), castPanel(lens)] },
		],
	};
}

function tiles(lens: Lens, graphName: string): PanelSpec {
	const rules = lens.rules ?? [];
	const closed = lens.closed_layers ?? [];
	const usage = lens.usage ?? null;
	// The resolved cast is checked against the guardrails; a role the bound
	// denies is a run that cannot open, so the world is not in force.
	const denied = (lens.cast_resolved ?? []).filter(
		(row) => row.address && !row.allowed,
	);

	return {
		kind: "grid",
		options: {
			minTileWidth: 160,
			tiles: [
				{
					label: "Rules",
					value: count(rules.length),
					delta: lens.deny_rules
						? `${count(lens.allow_rules)} allow · ${count(lens.deny_rules)} deny`
						: `${count(lens.allow_rules)} allow`,
				},
				{
					label: "Closed layers",
					value: count(closed.length),
					delta: closed.length
						? closed.map((l) => LAYER_LABEL[l]).join(" · ")
						: "none",
					tone: closed.length ? "warn" : undefined,
				},
				denied.length
					? {
							label: "In force",
							value: "no",
							delta: `${denied.map((d) => d.role).join(" · ")} denied by ${graphName} guardrails`,
							tone: "bad",
						}
					: {
							label: "In force",
							value: "yes",
							delta: `inside ${graphName} guardrails`,
							tone: "good",
						},
				{
					label: "Runs",
					value: count(usage?.runs_30d ?? 0),
					delta: "30 days",
				},
				{
					label: "Last used",
					value: since(usage?.last_used_at) ?? "—",
					delta: usage?.last_used_at ? undefined : "no run has picked it",
				},
			],
		},
	} as PanelSpec;
}

function layersPanel(lens: Lens): PanelSpec {
	return {
		kind: "list",
		title: "Five layers",
		options: {
			items: GOVERNED_LAYERS.map((layer) => {
				const { allows, state } = layerReading(lens, layer);
				return {
					id: layer,
					title: LAYER_LABEL[layer],
					meta: allows,
					chip: { label: state, tone: STATE_TONE[state] },
				};
			}),
		},
	};
}

function castPanel(lens: Lens): PanelSpec {
	const agents = lens.usage?.by_agent ?? [];
	if (!agents.length) {
		return {
			kind: "text",
			title: "Cast",
			aside: "who runs inside it",
			options: {
				tone: "muted",
				text: lens.usage?.runs
					? "Only people have asked under this world — no agent's run has."
					: "Nobody has asked under this world yet.",
			},
		};
	}
	return {
		kind: "table",
		title: "Cast",
		aside: "who runs inside it",
		flush: true,
		options: {
			columns: [
				{ key: "agent", label: "agent" },
				{ key: "runs", label: "runs", align: "right", mono: true },
				{ key: "last", label: "last", mono: true },
			],
			rows: agents.map((a) => ({
				agent: a.name ?? a.agent_id,
				runs: count(a.runs),
				last: since(a.last_at) ?? "—",
			})),
		},
	} as PanelSpec;
}
