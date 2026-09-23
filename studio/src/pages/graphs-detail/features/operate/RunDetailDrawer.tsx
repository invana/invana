/**
 * A run, read in the drawer — **five sections and two ways out**
 * ([SR67](../../../../../docs/for-developers/modules/operate/features/see-what-ran.md#decisions)).
 *
 * | Section | Answers |
 * |---|---|
 * | `The run` | what ran — plan, agent, lens, who opened it, how long |
 * | `What it cost` | spend against its ceiling, tokens, and the time it spent waiting rather than working |
 * | `What it touched` | one line per layer; a refusal struck, a layer nothing reached for dimmed |
 * | `Bounds reached` | each bounded repetition against its ceiling |
 * | `Refused` | every address a guardrail said no to, and why |
 *
 * **It stays an overview.** Where the time went, step by step, is the run
 * page's `In order` and `Layers` readings (SR46) — a Gantt in 420px was a
 * dashboard squeezed into a drawer. `Open the answer` opens that page;
 * `Compare with the plan` draws the plan it ran in `mainSection`, beside the
 * run, which stays open here.
 */

import { useRunTouchesQuery } from "@/hooks/queries/useGovern";
import { useAgentsQuery } from "@/hooks/queries/useWork";
import {
	isLive,
	toneOf,
} from "@/pages/graphs-detail/features/operate/dashboards/shared";
import { useRunTrace } from "@/pages/graphs-detail/features/operate/dashboards/useRunTrace";
import {
	type SummaryRow,
	planKeyOf,
	runSummary,
} from "@/pages/graphs-detail/features/operate/runSummary";
import { LAYER_PALETTE } from "@/ui/layerPalette";
import {
	AddressChip,
	Badge,
	Button,
	ClampedText,
	Eyebrow,
	PropertyList,
	PropertyRow,
	RecordHeader,
	Spinner,
	TouchStrip,
} from "@invana/ui";
import type { ReactNode } from "react";

export interface RunDetailDrawerProps {
	username: string;
	graphSlug: string;
	runId: string;
	/** `Open the answer` — opens this run's page (SR13). */
	onOpenDashboard?: (runId: string) => void;
	/** The lens row — opens that world or guardrail in Govern, in `leftSection`. */
	onOpenLens?: (lens: { id: string; kind: "world" | "guardrail" }) => void;
	/** `Compare with the plan` — draws the Library plan this run ran in `mainSection`. */
	onOpenPlan?: (planKey: string) => void;
}

/** `run:7d3184f1` — the last eight characters, as every crumb addresses a run (SR54). */
export function runAddress(runId: string): string {
	return `run:${runId.slice(-8)}`;
}

export function RunDetailDrawer({
	username,
	graphSlug,
	runId,
	onOpenDashboard,
	onOpenPlan,
	onOpenLens,
}: RunDetailDrawerProps) {
	const trace = useRunTrace(username, graphSlug, runId);
	const touches = useRunTouchesQuery(username, graphSlug, runId);
	const agents = useAgentsQuery(username, graphSlug).data?.items ?? [];

	if (trace.isLoading) {
		return (
			<div className="p-4">
				<Spinner />
			</div>
		);
	}
	if (!trace.data) {
		return (
			<p className="p-4 text-muted-foreground">
				This run's trace has been pruned.
			</p>
		);
	}

	const t = trace.data;
	const agentName = agents.find((a) => a.id === t.agent_id)?.name;
	const s = runSummary(t, touches.data, agentName);
	const planKey = planKeyOf(t);

	return (
		<div className="flex h-full min-h-0 flex-col">
			<RecordHeader
				tone={toneOf(t.status)}
				crumbs={[runAddress(t.run_id)]}
				chips={
					<>
						<Badge variant="outline" tone="muted" size="sm">
							{t.status}
						</Badge>
						{s.work ? (
							<Badge variant="outline" tone="muted" size="sm">
								{s.work}
							</Badge>
						) : null}
					</>
				}
			/>

			<div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 py-3">
				<Rows title="The run" rows={s.theRun} onOpenLens={onOpenLens} />
				{s.cost.length ? <Rows title="What it cost" rows={s.cost} /> : null}

				{s.touched.length ? (
					<Section
						title="What it touched"
						aside={
							s.refusedCount ? (
								<span className="text-destructive">
									{s.refusedCount} refused
								</span>
							) : undefined
						}
					>
						{touches.isLoading ? (
							<Spinner />
						) : (
							<TouchStrip
								orientation="column"
								palette={LAYER_PALETTE}
								items={s.touched}
							/>
						)}
					</Section>
				) : null}

				{s.bounds.length ? (
					<Rows
						title="Bounds reached"
						aside={s.boundsAside ?? undefined}
						rows={s.bounds}
					/>
				) : null}

				{s.refused.length ? (
					<Section title="Refused">
						{s.refused.map((r) => (
							<div key={r.address} className="flex flex-col gap-1">
								<AddressChip address={r.address} tone="refused" />
								<p className="text-muted-foreground">{r.why}</p>
							</div>
						))}
					</Section>
				) : null}
			</div>

			{onOpenDashboard || (onOpenPlan && planKey) ? (
				<div className="flex shrink-0 gap-2 border-t px-4 py-2.5">
					{onOpenDashboard ? (
						<Button onClick={() => onOpenDashboard(runId)}>
							{isLive(t.status) ? "Follow the run" : "Open the answer"}
						</Button>
					) : null}
					{onOpenPlan && planKey ? (
						<Button variant="outline" onClick={() => onOpenPlan(planKey)}>
							Compare with the plan
						</Button>
					) : null}
				</div>
			) : null}
		</div>
	);
}

function Section({
	title,
	aside,
	children,
}: {
	title: string;
	aside?: ReactNode;
	children: ReactNode;
}) {
	return (
		<section className="flex flex-col gap-1.5">
			<Eyebrow aside={aside}>{title}</Eyebrow>
			{children}
		</section>
	);
}

function Rows({
	title,
	aside,
	rows,
	onOpenLens,
}: {
	title: string;
	aside?: ReactNode;
	rows: SummaryRow[];
	onOpenLens?: RunDetailDrawerProps["onOpenLens"];
}) {
	return (
		<Section title={title} aside={aside}>
			<PropertyList labelWidth={112}>
				{rows.map((r) => (
					<PropertyRow
						key={r.label}
						label={r.label}
						mono={r.kind !== undefined || r.label !== "asked"}
					>
						<RowValue row={r} onOpenLens={onOpenLens} />
					</PropertyRow>
				))}
			</PropertyList>
		</Section>
	);
}

function RowValue({
	row,
	onOpenLens,
}: {
	row: SummaryRow;
	onOpenLens?: RunDetailDrawerProps["onOpenLens"];
}) {
	if (row.kind === "query") {
		// A query is read, not skimmed — clamped to three lines, whole on `more`.
		return (
			<ClampedText lines={3} className="whitespace-pre-wrap break-words">
				{row.value}
			</ClampedText>
		);
	}
	if (row.kind === "lens" && row.lens && onOpenLens) {
		const lens = row.lens;
		return (
			<Button
				variant="link"
				className="h-auto p-0 font-mono"
				onClick={() => onOpenLens(lens)}
			>
				{row.value}
			</Button>
		);
	}
	return <>{row.value}</>;
}
