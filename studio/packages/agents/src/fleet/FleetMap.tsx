/**
 * Fleet › **Map** — how the fleet is wired: agents → the skills they are
 * offered → the function namespaces those skills' plans call, on the
 * {@link LayeredCanvas} (the-agents-shell.md › Fleet).
 *
 * Three columns, read left to right:
 *
 * - **Agents** — the authored and seeded agents the Agents list holds (spawned
 *   helpers live in their runs), toned by status.
 * - **Skills** — every skill an agent is bound to, by `skill_ids`; *uses*.
 * - **Namespaces** — a function's dotted prefix (`graph.read.query` →
 *   `graph.read.*`), from each published skill's offered plan; *needs*.
 *
 * The legend floats over the map: what each colour and line means, how many
 * of each the map draws, and a switch per type that hides it.
 *
 * A click selects. The selected node's inspector takes the legend's place —
 * what it is, what it is wired to, and *Open*, which opens its page as a
 * workbook tab — and the map highlights what it reaches: the lines it is on
 * drawn in the accent, everything off them faded.
 *
 * The console under the map is its **Table**: one row per node the map draws,
 * of the type picked on its left. A row selects its node. A draft skill is
 * offered nothing, and a plan of only human steps calls no function, so
 * neither reaches a namespace. Pools join the map when Workers holds them.
 */

import { type ColumnDef, DataTable } from "@invana/tables";
import {
	Button,
	Eyebrow,
	FloatingPanel,
	Item,
	ItemActions,
	ItemContent,
	ItemGroup,
	ItemTitle,
	Legend,
	LegendItem,
	PropertyList,
	PropertyRow,
	TabbedPanel,
} from "@invana/ui";
import {
	LayeredCanvas,
	type LayeredEdge,
	type LayeredNode,
} from "@invana-studio/canvases";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useMemo, useState } from "react";
import type { Agent } from "../agents/types";
import { PAGE } from "../lists";
import { useAgentsOpen } from "../open";
import { FleetReadState } from "../overview/fleetParts";
import { useSkillPlaybooksQuery, useSkillsQuery } from "../skills/queries";
import type { Skill, SkillPlaybookRead } from "../skills/types";
import { BudgetCell, StatusCell } from "./agentCells";
import { type FleetAgentRow, useFleetAgentRows } from "./agentRows";

const LIST = { limit: PAGE };

/** A node id's prefix — the column it sits in. */
type Column = "agent" | "skill" | "ns";

const COLUMNS: {
	kind: Column;
	label: string;
	plural: string;
	color: string;
}[] = [
	{
		kind: "agent",
		label: "Agent",
		plural: "Agents",
		color: "var(--color-success)",
	},
	{
		kind: "skill",
		label: "Skill",
		plural: "Skills",
		color: "var(--color-info)",
	},
	{
		kind: "ns",
		label: "Namespace",
		plural: "Namespaces",
		color: "var(--color-muted-foreground)",
	},
];

/** `graph.read.query` → `graph.read`; a key with no dot is its own namespace. */
const namespaceOf = (key: string) =>
	key.includes(".") ? key.slice(0, key.lastIndexOf(".")) : key;

const NONE = <span className="text-muted-foreground">—</span>;

export function FleetMap({
	username,
	graphSlug,
}: {
	username: string;
	graphSlug: string;
}) {
	const open = useAgentsOpen();
	const agents = useFleetAgentRows(username, graphSlug);
	const skills = useSkillsQuery(username, graphSlug, LIST);
	const skillRows = useMemo(() => skills.data?.items ?? [], [skills.data]);
	const { plans } = useSkillPlaybooksQuery(username, graphSlug, skillRows);
	const [hidden, setHidden] = useState<ReadonlySet<Column>>(new Set());
	const [folded, setFolded] = useState(false);
	const [selected, setSelected] = useState<string | null>(null);
	const [consoleFolded, setConsoleFolded] = useState(false);
	const [consoleType, setConsoleType] = useState<Column>("agent");

	const fleet = useMemo(
		() => fleetModel(agents.rows, skillRows, plans),
		[agents.rows, skillRows, plans],
	);
	const shown = useMemo(
		() => withReach(withoutHidden(fleet.graph, hidden), selected),
		[fleet.graph, hidden, selected],
	);

	const error = agents.error ?? skills.error;
	if (agents.loading || skills.isLoading || error)
		return (
			<div className="p-3">
				<FleetReadState
					loading={agents.loading || skills.isLoading}
					error={error}
					what="the fleet"
				/>
			</div>
		);

	const toggle = (kind: Column) => {
		setHidden((prev) => {
			const next = new Set(prev);
			if (next.has(kind)) next.delete(kind);
			else next.add(kind);
			return next;
		});
		if (selected && splitId(selected)[0] === kind) setSelected(null);
	};
	const select = (nodeId: string | null) =>
		setSelected(
			nodeId && shown.nodes.some((n) => n.id === nodeId) ? nodeId : null,
		);

	return (
		<div className="flex h-full min-h-0 flex-col">
			<div className="relative min-h-0 flex-1">
				<LayeredCanvas
					kind="data"
					// Three piles in reading order; layering moves them for no reason.
					layout="fixed"
					nodes={shown.nodes}
					edges={shown.edges}
					selectedNodeId={selected}
					onSelectNode={(id) => select(id)}
					emptyHint={
						fleet.graph.nodes.length
							? "Every type is hidden — show one in the legend."
							: "No agents yet — an agent and the skills it is offered draw here."
					}
				/>
				{selected ? (
					<Inspector
						nodeId={selected}
						fleet={fleet}
						onClose={() => setSelected(null)}
						onOpen={(kind, id) =>
							kind === "agent" ? open.agent(id) : open.skill(id)
						}
					/>
				) : fleet.graph.nodes.length ? (
					<FloatingPanel
						className="absolute top-3 right-3 w-64"
						bodyClassName="px-3 py-2"
						title="Legend"
						aside={
							<span className="text-muted-foreground">
								{COLUMNS.length + 3} types
							</span>
						}
						collapsed={folded}
						onCollapsedChange={setFolded}
						footer={
							<span className="text-muted-foreground">
								Click a type to hide it on the map.
							</span>
						}
					>
						<MapLegend graph={fleet.graph} hidden={hidden} onToggle={toggle} />
					</FloatingPanel>
				) : null}
			</div>
			{fleet.graph.nodes.length ? (
				<div
					className={consoleFolded ? "h-control-md shrink-0" : "h-72 shrink-0"}
				>
					<TabbedPanel
						className="border-x-0 border-b-0"
						tabs={[
							{
								value: "table",
								label: "Table",
								content: (
									<MapTable
										fleet={fleet}
										type={consoleType}
										onType={setConsoleType}
										hidden={hidden}
										selected={selected}
										onSelect={select}
									/>
								),
							},
						]}
						headerActions={[
							consoleFolded
								? {
										name: "Show the console",
										icon: ChevronUp,
										onClick: () => setConsoleFolded(false),
									}
								: {
										name: "Fold the console",
										icon: ChevronDown,
										onClick: () => setConsoleFolded(true),
									},
						]}
					/>
				</div>
			) : null}
		</div>
	);
}

/** What the map draws, by type and by line, with a switch on each type. */
function MapLegend({
	graph,
	hidden,
	onToggle,
}: {
	graph: FleetGraph;
	hidden: ReadonlySet<Column>;
	onToggle: (kind: Column) => void;
}) {
	// What the canvas draws right now, not a figure of the fleet's.
	const count = (kind: Column) =>
		graph.nodes.filter((n) => splitId(n.id)[0] === kind).length;
	const lines = (label: string) =>
		graph.edges.filter((e) => e.label === label).length;
	return (
		<div className="flex flex-col gap-2">
			<Eyebrow>Nodes</Eyebrow>
			<Legend orientation="column">
				{COLUMNS.map((c) => (
					<LegendItem
						key={c.kind}
						kind="dot"
						color={c.color}
						label={c.label}
						count={count(c.kind)}
						pressed={!hidden.has(c.kind)}
						onToggle={() => onToggle(c.kind)}
					/>
				))}
			</Legend>
			<Eyebrow>States</Eyebrow>
			<Legend orientation="column">
				<LegendItem
					kind="dot"
					color="var(--color-warning)"
					label="agent · paused"
				/>
				<LegendItem
					kind="dot"
					color="var(--color-muted-foreground)"
					label="agent · retired"
				/>
				<LegendItem
					kind="dot"
					color="var(--color-muted-foreground)"
					label="skill · draft"
				/>
			</Legend>
			<Eyebrow>Relationships</Eyebrow>
			<Legend orientation="column">
				<LegendItem
					kind="line"
					color="var(--color-muted-foreground)"
					label="uses"
					count={lines("uses")}
				/>
				<LegendItem
					kind="dashed"
					color="var(--color-muted-foreground)"
					label="needs"
					count={lines("needs")}
				/>
			</Legend>
		</div>
	);
}

/** The selected node: what it is, what it is wired to, and the act that opens it. */
function Inspector({
	nodeId,
	fleet,
	onClose,
	onOpen,
}: {
	nodeId: string;
	fleet: FleetModel;
	onClose: () => void;
	onOpen: (kind: "agent" | "skill", id: string) => void;
}) {
	const [kind, id] = splitId(nodeId);
	const agent =
		kind === "agent" ? fleet.agents.find((a) => a.row.agent.id === id) : null;
	const skill =
		kind === "skill" ? fleet.skills.find((s) => s.skill.id === id) : null;
	const ns = kind === "ns" ? fleet.namespaces.find((n) => n.ns === id) : null;
	const words = (names: string[]) => (names.length ? names.join(" · ") : NONE);

	const title = agent?.row.agent.name ?? skill?.skill.name ?? `${id}.*`;
	const aside = agent
		? `agent · ${agent.row.agent.kind}`
		: skill
			? "skill"
			: "namespace";
	const act = agent
		? () => onOpen("agent", agent.row.agent.id)
		: skill
			? () => onOpen("skill", skill.skill.id)
			: null;

	return (
		<FloatingPanel
			className="absolute top-3 right-3 w-80"
			bodyClassName="px-3 py-2"
			title={title}
			aside={<span className="text-muted-foreground">{aside}</span>}
			onClose={onClose}
			footer={
				act ? (
					<div className="flex justify-end">
						<Button size="sm" onClick={act}>
							Open
						</Button>
					</div>
				) : undefined
			}
		>
			<PropertyList>
				{agent ? (
					<>
						<PropertyRow label="Now">
							<StatusCell row={agent.row} />
						</PropertyRow>
						<PropertyRow label="Version">
							v{agent.row.agent.version}
						</PropertyRow>
						<PropertyRow label="Skills">{words(agent.skills)}</PropertyRow>
						<PropertyRow label="Budget">
							<BudgetCell row={agent.row} />
						</PropertyRow>
					</>
				) : skill ? (
					<>
						<PropertyRow label="Version">
							{skillVersion(skill.skill)}
						</PropertyRow>
						<PropertyRow label="Plan">{planWords(skill.skill)}</PropertyRow>
						<PropertyRow label="Used by">{words(skill.usedBy)}</PropertyRow>
						<PropertyRow label="Needs">
							{words(skill.needs.map((n) => `${n}.*`))}
						</PropertyRow>
					</>
				) : ns ? (
					<>
						<PropertyRow label="Functions" mono>
							{words(ns.functions)}
						</PropertyRow>
						<PropertyRow label="Needed by">{words(ns.neededBy)}</PropertyRow>
					</>
				) : null}
			</PropertyList>
		</FloatingPanel>
	);
}

/** The console's Table: the type list on the left, its rows on the right. */
function MapTable({
	fleet,
	type,
	onType,
	hidden,
	selected,
	onSelect,
}: {
	fleet: FleetModel;
	type: Column;
	onType: (type: Column) => void;
	hidden: ReadonlySet<Column>;
	selected: string | null;
	onSelect: (nodeId: string) => void;
}) {
	// The rows the map draws — a small list, fully on screen.
	const counts: Record<Column, number> = {
		agent: fleet.agents.length,
		skill: fleet.skills.length,
		ns: fleet.namespaces.length,
	};
	// The selected node's row, marked the way a selected list row is.
	const marked = (nodeId: string) =>
		nodeId === selected ? "bg-accent" : undefined;
	const pick = (nodeId: string) => {
		if (!hidden.has(splitId(nodeId)[0] as Column)) onSelect(nodeId);
	};
	return (
		<div className="grid h-full min-h-0 grid-cols-[12rem_minmax(0,1fr)]">
			<ItemGroup className="border-r p-1">
				{COLUMNS.map((c) => (
					<Item
						key={c.kind}
						size="xs"
						selected={c.kind === type}
						aria-selected={c.kind === type}
						asChild
					>
						<button type="button" onClick={() => onType(c.kind)}>
							<ItemContent>
								<ItemTitle>{c.label}</ItemTitle>
							</ItemContent>
							<ItemActions className="text-muted-foreground">
								{counts[c.kind]}
							</ItemActions>
						</button>
					</Item>
				))}
			</ItemGroup>
			<div className="min-h-0 overflow-auto">
				{type === "agent" ? (
					<DataTable
						columns={AGENT_COLUMNS}
						data={fleet.agents}
						enableSorting={false}
						getRowId={(row) => `agent:${row.row.agent.id}`}
						rowClassName={(row) => marked(`agent:${row.row.agent.id}`)}
						onRowClick={(row) => pick(`agent:${row.row.agent.id}`)}
						emptyState="No agents on the map"
					/>
				) : type === "skill" ? (
					<DataTable
						columns={SKILL_COLUMNS}
						data={fleet.skills}
						enableSorting={false}
						getRowId={(row) => `skill:${row.skill.id}`}
						rowClassName={(row) => marked(`skill:${row.skill.id}`)}
						onRowClick={(row) => pick(`skill:${row.skill.id}`)}
						emptyState="No agent is offered a skill yet"
					/>
				) : (
					<DataTable
						columns={NS_COLUMNS}
						data={fleet.namespaces}
						enableSorting={false}
						getRowId={(row) => `ns:${row.ns}`}
						rowClassName={(row) => marked(`ns:${row.ns}`)}
						onRowClick={(row) => pick(`ns:${row.ns}`)}
						emptyState="No published plan calls a function yet"
					/>
				)}
			</div>
		</div>
	);
}

const AGENT_COLUMNS: ColumnDef<AgentLine>[] = [
	{
		id: "agent",
		header: "Agent",
		cell: ({ row }) => (
			<span className="font-medium">{row.original.row.agent.name}</span>
		),
	},
	{
		id: "version",
		header: "Version",
		cell: ({ row }) => (
			<span className="text-muted-foreground">
				{row.original.row.agent.kind} · v{row.original.row.agent.version}
			</span>
		),
	},
	{
		id: "skills",
		header: "Skills",
		cell: ({ row }) =>
			row.original.skills.length ? (
				<span className="text-muted-foreground">
					{row.original.skills.join(" · ")}
				</span>
			) : (
				NONE
			),
	},
	{
		id: "now",
		header: "Now",
		cell: ({ row }) => <StatusCell row={row.original.row} />,
	},
	{
		id: "budget",
		header: "Month budget",
		cell: ({ row }) => <BudgetCell row={row.original.row} />,
	},
];

const SKILL_COLUMNS: ColumnDef<SkillLine>[] = [
	{
		id: "skill",
		header: "Skill",
		cell: ({ row }) => (
			<span className="font-medium">{row.original.skill.name}</span>
		),
	},
	{
		id: "version",
		header: "Version",
		cell: ({ row }) => (
			<span className="font-mono">{skillVersion(row.original.skill)}</span>
		),
	},
	{
		id: "plan",
		header: "Plan",
		cell: ({ row }) => (
			<span className="text-muted-foreground">
				{planWords(row.original.skill)}
			</span>
		),
	},
	{
		id: "used",
		header: "Used by",
		cell: ({ row }) => (
			<span className="text-muted-foreground">
				{row.original.usedBy.join(" · ")}
			</span>
		),
	},
	{
		id: "needs",
		header: "Needs",
		cell: ({ row }) =>
			row.original.needs.length ? (
				<span className="font-mono text-muted-foreground">
					{row.original.needs.map((n) => `${n}.*`).join(" · ")}
				</span>
			) : (
				NONE
			),
	},
];

const NS_COLUMNS: ColumnDef<NamespaceLine>[] = [
	{
		id: "ns",
		header: "Namespace",
		cell: ({ row }) => (
			<span className="font-mono font-medium">{row.original.ns}.*</span>
		),
	},
	{
		id: "functions",
		header: "Functions",
		cell: ({ row }) => (
			<span className="font-mono text-muted-foreground">
				{row.original.functions.join(" · ")}
			</span>
		),
	},
	{
		id: "needed",
		header: "Needed by",
		cell: ({ row }) => (
			<span className="text-muted-foreground">
				{row.original.neededBy.join(" · ")}
			</span>
		),
	},
];

const skillVersion = (skill: Skill) =>
	skill.is_draft ? "draft" : `v${skill.version}`;

/** `4 steps · read · write` — the plan's size and the layers it reaches. */
function planWords(skill: Skill): string {
	const plan = skill.plan;
	if (!plan) return "—";
	const steps = `${plan.step_count} step${plan.step_count === 1 ? "" : "s"}`;
	return plan.layers.length ? `${steps} · ${plan.layers.join(" · ")}` : steps;
}

/** A node id is `<column kind>:<record id>`. */
function splitId(nodeId: string | undefined): [string, string] {
	if (!nodeId) return ["", ""];
	const at = nodeId.indexOf(":");
	return [nodeId.slice(0, at), nodeId.slice(at + 1)];
}

function agentTone(status: Agent["status"]): LayeredNode["tone"] {
	return status === "active"
		? "success"
		: status === "paused"
			? "warning"
			: "muted";
}

interface FleetGraph {
	nodes: LayeredNode[];
	edges: LayeredEdge[];
}

interface AgentLine {
	row: FleetAgentRow;
	/** The names of the skills it is offered. */
	skills: string[];
}

interface SkillLine {
	skill: Skill;
	/** The names of the agents offered it. */
	usedBy: string[];
	/** The namespaces its offered plan calls. */
	needs: string[];
}

interface NamespaceLine {
	ns: string;
	functions: string[];
	/** The names of the skills whose plans call it. */
	neededBy: string[];
}

/** The map, and the same wiring as the console's rows. */
interface FleetModel {
	graph: FleetGraph;
	agents: AgentLine[];
	skills: SkillLine[];
	namespaces: NamespaceLine[];
}

/** The map without the hidden types, and without the lines that reached them. */
function withoutHidden(
	graph: FleetGraph,
	hidden: ReadonlySet<Column>,
): FleetGraph {
	if (!hidden.size) return graph;
	const nodes = graph.nodes.filter(
		(n) => !hidden.has(splitId(n.id)[0] as Column),
	);
	const kept = new Set(nodes.map((n) => n.id));
	return {
		nodes,
		edges: graph.edges.filter((e) => kept.has(e.source) && kept.has(e.target)),
	};
}

/**
 * The map with what the selected node reaches marked: the lines downstream of
 * it and upstream of it highlighted, every node off them faded.
 */
function withReach(graph: FleetGraph, selected: string | null): FleetGraph {
	if (!selected || !graph.nodes.some((n) => n.id === selected)) return graph;
	const reached = new Set([selected]);
	const lit = new Set<string>();
	const walk = (from: "source" | "target", to: "source" | "target") => {
		const queue = [selected];
		while (queue.length) {
			const at = queue.shift() as string;
			for (const e of graph.edges) {
				if (e[from] !== at || lit.has(e.id)) continue;
				lit.add(e.id);
				if (!reached.has(e[to])) {
					reached.add(e[to]);
					queue.push(e[to]);
				}
			}
		}
	};
	walk("source", "target");
	walk("target", "source");
	return {
		nodes: graph.nodes.map((n) =>
			reached.has(n.id) ? n : { ...n, disabled: true },
		),
		edges: graph.edges.map((e) =>
			lit.has(e.id) ? { ...e, highlight: true } : e,
		),
	};
}

/** The three columns, the two kinds of edge between them, and the rows they make. */
function fleetModel(
	rows: FleetAgentRow[],
	skills: Skill[],
	plans: Map<string, SkillPlaybookRead>,
): FleetModel {
	const skillById = new Map(skills.map((s) => [s.id, s]));
	const nodes: LayeredNode[] = [];
	const edges: LayeredEdge[] = [];
	const agentLines: AgentLine[] = [];
	const usedBy = new Map<string, string[]>();

	for (const row of rows) {
		const agent = row.agent;
		nodes.push({
			id: `agent:${agent.id}`,
			label: agent.name,
			sub: `${agent.kind} · ${agent.status}`,
			column: 0,
			tone: agentTone(agent.status),
		});
		const names: string[] = [];
		for (const skillId of agent.skill_ids) {
			const skill = skillById.get(skillId);
			if (!skill) continue;
			names.push(skill.name);
			usedBy.set(skillId, [...(usedBy.get(skillId) ?? []), agent.name]);
			edges.push({
				id: `uses:${agent.id}:${skillId}`,
				source: `agent:${agent.id}`,
				target: `skill:${skillId}`,
				label: "uses",
			});
		}
		agentLines.push({ row, skills: names });
	}

	// The functions each namespace is reached for, in first-seen order.
	const namespaces = new Map<string, { fns: Set<string>; by: string[] }>();
	const skillLines: SkillLine[] = [];
	for (const skill of skills) {
		const by = usedBy.get(skill.id);
		if (!by) continue;
		nodes.push({
			id: `skill:${skill.id}`,
			label: skill.name,
			sub: skillVersion(skill),
			column: 1,
			tone: skill.is_draft ? "muted" : "info",
		});
		const reached = new Set<string>();
		for (const node of plans.get(skill.id)?.nodes ?? []) {
			if (!node.task) continue;
			const ns = namespaceOf(node.task);
			const entry = namespaces.get(ns) ?? { fns: new Set<string>(), by: [] };
			entry.fns.add(node.task.slice(ns.length + 1) || node.task);
			if (!reached.has(ns)) entry.by.push(skill.name);
			namespaces.set(ns, entry);
			reached.add(ns);
		}
		for (const ns of reached)
			edges.push({
				id: `needs:${skill.id}:${ns}`,
				source: `skill:${skill.id}`,
				target: `ns:${ns}`,
				label: "needs",
				dashed: true,
			});
		skillLines.push({ skill, usedBy: by, needs: [...reached] });
	}

	const nsLines: NamespaceLine[] = [];
	for (const [ns, { fns, by }] of namespaces) {
		nodes.push({
			id: `ns:${ns}`,
			label: `${ns}.*`,
			sub: [...fns].join(" · "),
			column: 2,
			tone: "muted",
		});
		nsLines.push({ ns, functions: [...fns], neededBy: by });
	}

	return {
		graph: { nodes, edges },
		agents: agentLines,
		skills: skillLines,
		namespaces: nsLines,
	};
}
