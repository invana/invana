/**
 * An agent's access page in IAM (board `iam.agent.effective`), opened as a
 * tab of its own (`?page=iam_agent:<id>`). Read-only: the agent is built in
 * Agents, which *Open in Agents* reaches.
 *
 * *As an owner, I want an agent's policies and effective access, with why
 * each function is allowed or refused, so that I see why it can or can't.*
 *
 * Three tabs, `?tab=` while the page is in front:
 *
 * | Tab | Reads |
 * |---|---|
 * | Effective access | The matrix — action · resource · skill needs · its policies · started by · world · boundary · effective · why not — grouped by layer, *as started by* a chosen person *in* a chosen world; then *Who it may delegate to* |
 * | Policies | The policies it holds, direct and through its groups; a name opens the policy |
 * | Refusals | Its ledger rows refused, newest first |
 *
 * Every verdict and every *why not* is the engine's (`…/agents/{id}/effective`).
 * No person chosen, the started-by column reads `—` and does not refuse.
 */

import {
	Label,
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@invana/forms";
import { type ColumnDef, DataTable } from "@invana/tables";
import {
	Badge,
	Button,
	EmptyState,
	RecordHeader,
	TabbedPanel,
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@invana/ui";
import { useLensesQuery } from "@invana-studio/core";
import { PanelSection } from "@invana-studio/ui";
import { Bot, Check, Layers, Minus, ScrollText, X } from "lucide-react";
import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useIamOpen } from "../open";
import { joined, PAGE, ReadState } from "../people/listParts";
import {
	useEffectiveQuery,
	usePeopleQuery,
	useRefusalsQuery,
} from "../queries";
import type {
	Delegate,
	EffectiveRead,
	EffectiveRow,
	HeldPolicy,
	RefusalRow,
	Says,
} from "../types";

export interface IamAgentPageProps {
	username: string;
	graphSlug: string;
	/** `agents.id`. */
	agentId: string;
}

const TABS = [
	{ value: "effective", label: "Effective access" },
	{ value: "policies", label: "Policies" },
	{ value: "refusals", label: "Refusals" },
] as const;
type Tab = (typeof TABS)[number]["value"];
const isTab = (v: string | null): v is Tab => TABS.some((t) => t.value === v);

/** A select's value for *nobody* and *no world* — a Select item cannot be empty. */
const NONE = "none";

/** The open tab: `?tab=` while this page is the one in front, else its own. */
function useTab(agentId: string): [Tab, (tab: Tab) => void] {
	const [params, setParams] = useSearchParams();
	const [local, setLocal] = useState<Tab>("effective");
	const inFront = params.get("page") === `iam_agent:${agentId}`;
	const fromUrl = params.get("tab");
	const tab = inFront ? (isTab(fromUrl) ? fromUrl : "effective") : local;
	const setTab = (next: Tab) => {
		setLocal(next);
		if (!inFront) return;
		setParams(
			(prev) => {
				const out = new URLSearchParams(prev);
				out.set("tab", next);
				return out;
			},
			{ replace: true },
		);
	};
	return [tab, setTab];
}

export function IamAgentPage({
	username,
	graphSlug,
	agentId,
}: IamAgentPageProps) {
	const open = useIamOpen();
	const [tab, setTab] = useTab(agentId);
	// The head and the Policies tab read the agent as nobody started it.
	const base = useEffectiveQuery(username, graphSlug, agentId);
	const agent = base.data;
	const crumbs = [
		{ label: "Agents", onClick: () => open.section("agents") },
		agent?.agent ?? "Agent",
	];
	const openInAgents = (
		<Button
			size="sm"
			variant="outline"
			onClick={() => open.agentInAgents(agentId)}
		>
			<Bot className="size-3.5" />
			Open in Agents
		</Button>
	);

	if (!agent)
		return (
			<div className="flex h-full min-h-0 flex-col">
				<RecordHeader
					variant="page"
					icon={<Bot />}
					crumbs={crumbs}
					actions={openInAgents}
				/>
				<ReadState
					loading={base.isLoading}
					error={base.error}
					what="this agent's access"
					onRetry={() => void base.refetch()}
				/>
			</div>
		);

	const body = (t: Tab) => {
		switch (t) {
			case "effective":
				return (
					<EffectiveTab
						username={username}
						graphSlug={graphSlug}
						agentId={agentId}
					/>
				);
			case "policies":
				return <PoliciesTab policies={agent.policies} />;
			case "refusals":
				return (
					<RefusalsTab
						username={username}
						graphSlug={graphSlug}
						agentId={agentId}
					/>
				);
		}
	};

	return (
		<div className="flex h-full min-h-0 flex-col">
			<RecordHeader
				variant="page"
				icon={<Bot />}
				crumbs={crumbs}
				chips={
					<>
						<Badge variant="outline" size="xs">
							{agent.kind}
						</Badge>
						<span className="truncate text-sm text-muted-foreground">
							holds {joined(agent.policies.map((p) => p.name))}
							{agent.owner ? ` · owner ${agent.owner}` : ""}
						</span>
					</>
				}
				actions={openInAgents}
			/>
			<TabbedPanel
				className="min-h-0 flex-1 border-0 bg-transparent shadow-none"
				activeTab={tab}
				onTabChange={(v) => setTab(v as Tab)}
				tabs={TABS.map((t) => ({
					value: t.value,
					label: t.label,
					content: t.value === tab ? body(t.value) : null,
				}))}
			/>
		</div>
	);
}

// ── Effective access ────────────────────────────────────────────────────────

const SAYS_LABEL: Record<Says, string> = {
	allows: "allows",
	refuses: "refuses",
	"n/a": "does not apply",
};

function SaysMark({ says }: { says: Says }) {
	if (says === "allows")
		return (
			<Check aria-label={SAYS_LABEL[says]} className="size-3.5 text-success" />
		);
	if (says === "refuses")
		return (
			<X aria-label={SAYS_LABEL[says]} className="size-3.5 text-destructive" />
		);
	return (
		<Minus
			aria-label={SAYS_LABEL[says]}
			className="size-3.5 text-muted-foreground"
		/>
	);
}

const DELEGATE: Record<
	Delegate["may"],
	{ label: string; tone: "success" | "warning" | "muted" }
> = {
	always: { label: "always", tone: "success" },
	ask: { label: "asks its owner", tone: "warning" },
	never: { label: "never", tone: "muted" },
};

function EffectiveTab({
	username,
	graphSlug,
	agentId,
}: {
	username: string;
	graphSlug: string;
	agentId: string;
}) {
	const open = useIamOpen();
	const [startedBy, setStartedBy] = useState(NONE);
	const [world, setWorld] = useState(NONE);
	const people = usePeopleQuery(username, graphSlug, {
		filters: { kind: ["person"] },
		limit: PAGE,
	});
	const worlds = useLensesQuery(username, graphSlug, { kind: "world" });
	const query = useEffectiveQuery(username, graphSlug, agentId, {
		started_by: startedBy === NONE ? undefined : startedBy,
		world_id: world === NONE ? undefined : world,
	});
	const data = query.data;
	const columns = useMemo(effectiveColumns, []);

	return (
		<div className="flex flex-col gap-3 p-3">
			<div className="flex flex-wrap items-center gap-2">
				<Label htmlFor="iam-started-by" className="text-muted-foreground">
					As started by
				</Label>
				<Select value={startedBy} onValueChange={setStartedBy}>
					<SelectTrigger id="iam-started-by" className="w-48">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value={NONE}>no one — a schedule, a seed</SelectItem>
						{(people.data?.items ?? []).map((p) => (
							<SelectItem key={p.user_id} value={p.user_id}>
								{p.username}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
				<Label htmlFor="iam-world" className="text-muted-foreground">
					in world
				</Label>
				<Select value={world} onValueChange={setWorld}>
					<SelectTrigger id="iam-world" className="w-48">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value={NONE}>no world</SelectItem>
						{(worlds.data?.items ?? []).map((w) => (
							<SelectItem key={w.id} value={w.id}>
								{w.display_name}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
				<span className="ml-auto text-muted-foreground">
					{data ? `${data.allowed} allowed · ${data.refused} refused · ` : ""}
					Allowed only where every column allows
				</span>
			</div>
			{!data ? (
				<ReadState
					loading={query.isLoading}
					error={query.error}
					what="what this agent may do"
					onRetry={() => void query.refetch()}
				/>
			) : (
				<>
					<DataTable
						columns={columns}
						data={data.rows}
						loading={query.isFetching}
						enableSorting={false}
						density="compact"
						getRowId={(r) => `${r.action} ${r.resource}`}
						groupBy={(r) => r.layer}
						renderGroupHeader={(key, rows) => (
							<span className="flex items-center gap-2">
								<Layers className="size-3.5 text-muted-foreground" />
								<span className="font-mono font-medium">
									{layerLabel(data, key)}
								</span>
								<span className="ml-auto text-muted-foreground">
									{rows.length} {rows.length === 1 ? "row" : "rows"}
								</span>
							</span>
						)}
						emptyState={
							<EmptyState
								title="Nothing to show"
								description="No skill needs a function and no policy it holds allows one."
							/>
						}
					/>
					<PanelSection card title="Who it may delegate to">
						{data.delegates.length ? (
							<Table bordered={false} density="compact">
								<TableHeader>
									<TableRow>
										<TableHead>Agent</TableHead>
										<TableHead>By</TableHead>
										<TableHead>May delegate</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{data.delegates.map((d) => (
										<TableRow key={d.agent_id}>
											<TableCell className="font-medium">{d.name}</TableCell>
											<TableCell>
												{d.by_policy ? (
													<Button
														size="xs"
														variant="ghost"
														onClick={() =>
															d.by_policy && open.policy(d.by_policy)
														}
													>
														<ScrollText className="size-3.5" />
														{d.by_policy}
													</Button>
												) : (
													<span className="text-muted-foreground">
														no policy
													</span>
												)}
											</TableCell>
											<TableCell>
												<Badge
													size="xs"
													variant="soft"
													tone={DELEGATE[d.may].tone}
												>
													{DELEGATE[d.may].label}
												</Badge>
											</TableCell>
										</TableRow>
									))}
								</TableBody>
							</Table>
						) : (
							<p className="text-muted-foreground">
								No other agent it may hand work to.
							</p>
						)}
					</PanelSection>
				</>
			)}
		</div>
	);
}

function layerLabel(data: EffectiveRead, key: string): string {
	return data.layers.find((l) => l.layer === key)?.label ?? key;
}

function effectiveColumns(): ColumnDef<EffectiveRow>[] {
	const says = (
		id: keyof Pick<
			EffectiveRow,
			"policies" | "started_by" | "world" | "boundary"
		>,
		header: string,
	): ColumnDef<EffectiveRow> => ({
		id,
		header,
		cell: ({ row }) => <SaysMark says={row.original[id]} />,
	});
	return [
		{
			id: "action",
			header: "Action",
			cell: ({ row }) => (
				<Badge
					variant="outline"
					tone="muted"
					size="xs"
					className={`font-mono font-normal${row.original.effective === "allowed" ? "" : " line-through"}`}
				>
					{row.original.action}
				</Badge>
			),
		},
		{
			id: "resource",
			header: "Resource",
			cell: ({ row }) => (
				<span className="font-mono">{row.original.resource}</span>
			),
		},
		{
			id: "needs",
			header: "Skill needs",
			cell: ({ row }) => (
				<SaysMark says={row.original.needs ? "allows" : "refuses"} />
			),
		},
		says("policies", "Its policies"),
		says("started_by", "Started by"),
		says("world", "World"),
		says("boundary", "Boundary"),
		{
			id: "effective",
			header: "Effective",
			cell: ({ row }) => (
				<Badge
					size="xs"
					variant="soft"
					tone={
						row.original.effective === "allowed" ? "success" : "destructive"
					}
				>
					{row.original.effective}
				</Badge>
			),
		},
		{
			id: "why",
			header: "Why not",
			cell: ({ row }) => (
				<span className="text-muted-foreground">{row.original.why}</span>
			),
		},
	];
}

// ── Policies ────────────────────────────────────────────────────────────────

function PoliciesTab({ policies }: { policies: HeldPolicy[] }) {
	const open = useIamOpen();
	const columns = useMemo<ColumnDef<HeldPolicy>[]>(
		() => [
			{
				id: "policy",
				header: "Policy",
				cell: ({ row }) => (
					<span className="font-medium">{row.original.name}</span>
				),
			},
			{
				id: "kind",
				header: "Kind",
				cell: ({ row }) => (
					<span className="text-muted-foreground">{row.original.kind}</span>
				),
			},
			{ id: "allows", header: "Allows", accessorKey: "summary" },
			{
				id: "how",
				header: "How",
				cell: ({ row }) => (
					<span className="text-muted-foreground">{row.original.how}</span>
				),
			},
			{
				id: "owner",
				header: "Owner",
				cell: ({ row }) => (
					<span className="text-muted-foreground">
						{row.original.owner ?? "—"}
					</span>
				),
			},
		],
		[],
	);
	return (
		<div className="p-3">
			<DataTable
				columns={columns}
				data={policies}
				enableSorting={false}
				getRowId={(p) => p.id}
				onRowClick={(p) => open.policy(p.name)}
				emptyState={
					<EmptyState
						title="Holds no policy"
						description="Every function needing a statement is refused. Attach a policy from Policies, or from the agent's Access tab in Agents."
					/>
				}
			/>
		</div>
	);
}

// ── Refusals ────────────────────────────────────────────────────────────────

const when = (iso: string) =>
	new Date(iso).toLocaleString("en", {
		month: "short",
		day: "numeric",
		hour: "2-digit",
		minute: "2-digit",
	});

function RefusalsTab({
	username,
	graphSlug,
	agentId,
}: {
	username: string;
	graphSlug: string;
	agentId: string;
}) {
	const query = useRefusalsQuery(username, graphSlug, agentId, {
		limit: PAGE,
	});
	const columns = useMemo<ColumnDef<RefusalRow>[]>(
		() => [
			{
				id: "at",
				header: "When",
				cell: ({ row }) => (
					<span className="text-muted-foreground">{when(row.original.at)}</span>
				),
			},
			{
				id: "act",
				header: "Act",
				cell: ({ row }) => (
					<span className="font-mono">{row.original.act}</span>
				),
			},
			{
				id: "touched",
				header: "Touched",
				cell: ({ row }) => (
					<span className="font-mono">{row.original.touched_line}</span>
				),
			},
			{
				id: "refused_by",
				header: "Refused by",
				cell: ({ row }) => row.original.refused_by ?? "—",
			},
			{
				id: "rule",
				header: "Why",
				cell: ({ row }) => (
					<span className="text-muted-foreground">{row.original.rule}</span>
				),
			},
			{
				id: "run",
				header: "Run",
				cell: ({ row }) =>
					row.original.run_number != null ? (
						<span className="font-mono">#{row.original.run_number}</span>
					) : (
						"—"
					),
			},
		],
		[],
	);
	const page = query.data;
	return (
		<div className="p-3">
			{!page ? (
				<ReadState
					loading={query.isLoading}
					error={query.error}
					what="what was refused"
					onRetry={() => void query.refetch()}
				/>
			) : (
				<DataTable
					columns={columns}
					data={page.items}
					loading={query.isFetching}
					enableSorting={false}
					getRowId={(r) => r.id}
					emptyState={
						<EmptyState
							title="Nothing refused"
							description="Every step this agent took was allowed."
						/>
					}
				/>
			)}
		</div>
	);
}
