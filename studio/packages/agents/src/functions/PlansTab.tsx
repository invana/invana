/**
 * Functions › Packaged plans and Promoted plans — the plan library, split by
 * where a plan came from.
 *
 * *Packaged* is what came with Invana or a plugin (`origin=packaged`);
 * *Promoted* is what this Graph made — a plan that served and was promoted,
 * or one authored before promotion was the way in (`origin=promoted ·
 * authored`). A one-off `generated` plan belongs to its Todo and is never
 * listed. The engine searches and filters; a row opens the plan's page — its
 * flow, its versions, its export — as a tab beside this one.
 *
 * The layers a plan engages are on the row, because *what will this cost me*
 * is the question a library is scanned with. Packaged plans open under a
 * banner saying how one is called; Promoted plans say they are never drawn
 * by hand, carry when each last ran, and an empty list offers the head's *Promote a
 * plan*.
 */

import {
	Alert,
	AlertDescription,
	EmptyState,
	type Layer,
	LayerChip,
	SearchInput,
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
	TypographyInlineCode,
} from "@invana/ui";
import { formatRelativeTime } from "@invana-studio/core";
import { ActButton } from "@invana-studio/shell";
import { LAYER_PALETTE, layerSlug } from "@invana-studio/ui";
import { GitBranch, GitBranchPlus } from "lucide-react";
import { FilteredEmpty } from "../lists";
import { useAgentsOpen } from "../open";
import { useFlowsQuery } from "../plans/queries";
import type { FlowSummary } from "../plans/types";
import { RowsFailed, RowsLoading, useTabList } from "./shared";

/** The origins each tab lists. */
const ORIGINS = {
	packaged: ["packaged"],
	promoted: ["promoted", "authored"],
} as const;

export function PlansTab({
	username,
	graphSlug,
	origin,
	onPromote,
}: {
	username: string;
	graphSlug: string;
	origin: keyof typeof ORIGINS;
	/** Opens the section head's *Promote a plan* — the one dialog the page has. */
	onPromote: () => void;
}) {
	const open = useAgentsOpen();
	const { list, query, search } = useTabList([]);
	const plans = useFlowsQuery(username, graphSlug, {
		...query,
		filters: { origin: [...ORIGINS[origin]] },
		sort: "key",
	});
	const rows = plans.data?.items ?? [];
	const promoted = origin === "promoted";

	return (
		<div className="flex flex-col gap-2">
			{promoted ? null : (
				<Alert tone="info">
					<GitBranch className="size-4" />
					<AlertDescription>
						A packaged plan is called like a function and runs as a plan — every
						step one function with one bound.
					</AlertDescription>
				</Alert>
			)}
			<div className="flex flex-wrap items-center gap-2">
				<SearchInput
					inputSize="sm"
					value={search}
					onChange={list.setQ}
					placeholder="Search plans by name or key"
					className="w-72"
				/>
				{promoted ? (
					<span className="ml-auto text-muted-foreground">
						Plans are generated, never drawn by hand
					</span>
				) : null}
			</div>
			{plans.isLoading ? (
				<RowsLoading />
			) : plans.isError ? (
				<RowsFailed what="The plan library" error={plans.error} />
			) : rows.length === 0 ? (
				query.q ? (
					<FilteredEmpty
						noun="plan"
						filters={list.pending}
						onClear={list.clear}
					/>
				) : promoted ? (
					<EmptyState
						title="No promoted plans yet"
						description="A plan the engine generated, that served, becomes a library entry when it is promoted."
						actions={
							<ActButton
								area="build"
								size="sm"
								variant="outline"
								onClick={onPromote}
							>
								<GitBranchPlus />
								Promote a plan
							</ActButton>
						}
					/>
				) : (
					<EmptyState title="No packaged plans in this Graph" />
				)
			) : (
				<Table density="compact">
					<TableHeader>
						<TableRow>
							<TableHead>Plan</TableHead>
							<TableHead className="w-full">What it does</TableHead>
							{promoted ? <TableHead>Origin</TableHead> : null}
							<TableHead>Kind</TableHead>
							<TableHead>Steps</TableHead>
							<TableHead>Layers</TableHead>
							<TableHead className="whitespace-nowrap">Used by</TableHead>
							<TableHead className="text-right">Runs</TableHead>
							<TableHead>Served</TableHead>
							{promoted ? (
								<TableHead className="whitespace-nowrap">Last run</TableHead>
							) : null}
						</TableRow>
					</TableHeader>
					<TableBody>
						{rows.map((p) => (
							<PlanRow
								key={p.id}
								plan={p}
								promoted={promoted}
								onOpen={() => open.plan(p.id)}
							/>
						))}
					</TableBody>
				</Table>
			)}
		</div>
	);
}

function PlanRow({
	plan: p,
	promoted,
	onOpen,
}: {
	plan: FlowSummary;
	promoted: boolean;
	onOpen: () => void;
}) {
	return (
		<TableRow className="cursor-pointer" onClick={onOpen}>
			<TableCell className="whitespace-nowrap">
				<TypographyInlineCode>
					{p.key ?? p.name}@{p.version}
				</TypographyInlineCode>
			</TableCell>
			<TableCell>{p.description || p.name}</TableCell>
			{promoted ? <TableCell>{p.origin}</TableCell> : null}
			<TableCell>{p.kind}</TableCell>
			<TableCell>{p.step_count}</TableCell>
			<TableCell className="whitespace-nowrap">
				<span className="flex gap-1">
					{/* Every plan is dispatched by the runtime, so the spine carries nothing on a row. */}
					{p.layers
						.filter((layer) => layer !== "agent")
						.map((layer) => (
							<LayerChip
								key={layer}
								layer={layerSlug(layer) as Layer}
								palette={LAYER_PALETTE}
							/>
						))}
				</span>
			</TableCell>
			<TableCell className="whitespace-nowrap">
				{p.caller_count
					? `${p.caller_count} caller${p.caller_count === 1 ? "" : "s"}`
					: "none"}
			</TableCell>
			<TableCell className="text-right">{p.runs.toLocaleString()}</TableCell>
			<TableCell className="whitespace-nowrap">
				{/* Never 0%: *never verified* and *verified and failed* are different facts. */}
				{p.served_rate == null ? "—" : `${Math.round(p.served_rate * 100)}%`}
			</TableCell>
			{promoted ? (
				<TableCell className="whitespace-nowrap text-muted-foreground">
					{p.last_run_at ? formatRelativeTime(new Date(p.last_run_at)) : "—"}
				</TableCell>
			) : null}
		</TableRow>
	);
}
