/**
 * The cells Fleet's *Agents* card and its Table draw the same way: p95 with
 * its change against the 7 days before, the change in words, the month's
 * tokens against the agent's month budget, and the agent's status.
 *
 * Every figure is the engine's; these only format it. A meter's fill is the
 * one ratio drawn here. Tokens, never currency.
 */

import { Progress, StatusDot } from "@invana/ui";
import { agentTone } from "@invana-studio/ui";
import {
	changeText,
	changeTone,
	ms,
	TONE_TEXT,
	tokens,
} from "../overview/fleetParts";
import type { FleetAgentRow } from "./agentRows";
import type { PerformanceRow } from "./types";

const NONE = <span className="text-muted-foreground">—</span>;

/**
 * `48s ▲ 38%` — p95 and its change against its prior: the 7 days before for an
 * agent, the previous version for a skill.
 */
export function P95Cell({ perf }: { perf: PerformanceRow | null }) {
	if (!perf) return NONE;
	const change = perf.p95_change;
	return (
		<span className="font-mono">
			{ms(perf.p95_ms)}
			{change && change.direction !== "flat" ? (
				<span className={TONE_TEXT[changeTone(change)]}>
					{" "}
					{changeText(change, ["▲", "▼"])}
				</span>
			) : null}
		</span>
	);
}

/**
 * The agent against the 7 days before: its failing streak when it is failing,
 * else its p95's change — `steady` when the engine reads it flat.
 */
export function AgainstCell({ row }: { row: FleetAgentRow }) {
	const perf = row.perf;
	if (!perf) return NONE;
	if (perf.signal === "failing")
		return <span className="text-destructive">{perf.failing} failed</span>;
	const change = perf.p95_change;
	if (!change) return NONE;
	if (change.direction === "flat")
		return <span className="text-muted-foreground">steady</span>;
	return (
		<span className={TONE_TEXT[changeTone(change)]}>
			p95 {changeText(change, ["▲", "▼"])}
		</span>
	);
}

/** The month's tokens against the agent's own month budget, when it set one. */
export function BudgetCell({ row }: { row: FleetAgentRow }) {
	const max = row.agent.budget?.max_tokens_month;
	if (!max)
		return (
			<span className="font-mono text-muted-foreground">
				{tokens(row.tokensThisMonth)}
			</span>
		);
	return (
		<span className="inline-flex items-center gap-2">
			<Progress
				size="sm"
				className="w-20"
				value={Math.min(100, (row.tokensThisMonth / max) * 100)}
				aria-label={`${row.agent.name} month budget`}
			/>
			<span className="font-mono text-muted-foreground">
				{tokens(row.tokensThisMonth)} of {tokens(max)}
			</span>
		</span>
	);
}

export function StatusCell({ row }: { row: FleetAgentRow }) {
	return (
		<span className="inline-flex items-center gap-1.5">
			<StatusDot tone={agentTone(row.agent.status)} />
			{row.agent.status}
		</span>
	);
}
