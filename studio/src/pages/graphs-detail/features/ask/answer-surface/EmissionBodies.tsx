/**
 * One body per emission kind
 * (docs/for-developers/modules/ask/features/the-answer-surface.md · "The kinds").
 *
 * A body is what sits under the emission header, never a block of its own
 * (AS8), so none of these draws a border or a title — the card owns both. They
 * take their own payload type and nothing else: no session, no message, no
 * store. That is what lets the same body render in the thread, on a task result
 * and in a scheduled answer (Ask K8).
 *
 * `metric`, `chart` and `prose` have no producer yet — the engine's project step
 * emits a query result, not typed emissions (3.3 API is not built). They are
 * drawn here because Studio leads the engine on the answer surface: 13.1 blocks
 * on these components existing (Ask §7a).
 */

import { ResultsTable } from "@/pages/graphs-detail/features/ask/answer-surface/ResultsTable";
import type {
	ChartEmission,
	EmptyEmission,
	MetricEmission,
	ProseEmission,
	SubgraphEmission,
	TableEmission,
} from "@/types/emission";

/** Rows of records — windowed, so a large result never bloats the thread. */
export function TableEmissionBody({ emission }: { emission: TableEmission }) {
	return <ResultsTable rows={emission.rows} />;
}

/** What landed on the canvas. A subgraph adds; it never replaces (AS5). */
export function SubgraphBody({ emission }: { emission: SubgraphEmission }) {
	const { nodes, edges } = emission.data;
	const summary = `${nodes.length.toLocaleString()} ${nodes.length === 1 ? "node" : "nodes"} · ${edges.length.toLocaleString()} ${edges.length === 1 ? "edge" : "edges"}`;
	return (
		<div className="px-[9px] py-2 text-sm text-muted-foreground">
			{emission.onCanvas
				? `${summary} added to the canvas — nothing replaced`
				: `${summary} in this answer`}
		</div>
	);
}

/** One number that answers the question, with what it is measured against. */
export function MetricBody({ emission }: { emission: MetricEmission }) {
	return (
		<div className="px-[9px] py-2">
			<div className="flex items-baseline gap-2">
				<span className="text-lg font-semibold leading-none">
					{emission.value}
				</span>
				{emission.label && (
					<span className="text-sm text-muted-foreground">
						{emission.label}
					</span>
				)}
			</div>
			{emission.comparison && (
				<div className="mt-1 text-sm text-muted-foreground">
					{emission.comparison}
				</div>
			)}
		</div>
	);
}

/** Bars across categories: the label and the value ride on the row. */
export function ChartBody({ emission }: { emission: ChartEmission }) {
	const max = Math.max(...emission.series.map((p) => Math.abs(p.value)), 1);
	return (
		<div className="px-[9px] py-2">
			{emission.caption && (
				<div className="mb-1.5 text-sm text-muted-foreground">
					{emission.caption}
				</div>
			)}
			<div className="flex flex-col gap-0.5">
				{emission.series.map((point) => (
					<div key={point.label} className="flex h-4 items-center gap-2">
						<span className="w-20 shrink-0 truncate text-sm text-muted-foreground">
							{point.label}
						</span>
						<span className="flex h-1.5 min-w-0 flex-1 items-center">
							<span
								className="h-full rounded-sm bg-primary/70"
								style={{
									width: `${Math.max((Math.abs(point.value) / max) * 100, 2)}%`,
								}}
							/>
						</span>
						<span className="w-12 shrink-0 text-right text-sm tabular-nums">
							{point.display ?? point.value.toLocaleString()}
						</span>
					</div>
				))}
			</div>
		</div>
	);
}

/** A statement the records support — and the records it stands on (AS4). */
export function ProseBody({ emission }: { emission: ProseEmission }) {
	return (
		<div className="px-[9px] py-2 text-sm">
			<p className="whitespace-pre-wrap break-words">{emission.text}</p>
			{emission.citations && emission.citations.length > 0 && (
				<p className="mt-1 text-sm text-muted-foreground">
					{emission.citations.join(" · ")}
				</p>
			)}
		</div>
	);
}

/** Zero records, worded as an answer rather than drawn as a blank table (AS7). */
export function EmptyBody({ emission }: { emission: EmptyEmission }) {
	return (
		<div className="px-[9px] py-2 text-sm text-muted-foreground">
			{emission.statement}
		</div>
	);
}
