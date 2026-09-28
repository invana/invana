/**
 * The plan page's two charts as dashboard panels — Studio's registry entries,
 * the way `flow` is (LB33).
 *
 * A dashboard ships eleven kinds and a twelfth belongs there only when two
 * unrelated surfaces need it; these two are drawn by the kit's charts, and the
 * panels only hand them the spec's data.
 */

import {
	LineChart,
	type LineChartMark,
	StackedBarChartV,
} from "@invana/charts";
import type { PanelRendererProps } from "@invana/dashboard";
import { formatElapsed } from "@/lib/time";

export interface DailyRunsOptions {
	days: { label: string; served: number; failed: number }[];
	ticks: number[];
}

export interface PlanTrendOptions {
	/** Work p50 a day, in ms; `null` on a day nothing ran. */
	values: (number | null)[];
	labels: string[];
	ticks: number[];
	marks: LineChartMark[];
}

export type PlanChartWidgets = {
	dailyRuns: DailyRunsOptions;
	workTrend: PlanTrendOptions;
};

/** **Runs a day** — served and failed stacked on one count axis. */
export function DailyRunsWidget({
	options,
}: PanelRendererProps<DailyRunsOptions>) {
	const top = Math.max(1, ...options.days.map((d) => d.served + d.failed));
	return (
		<StackedBarChartV
			max={top}
			gridlines={[Math.ceil(top / 2), top]}
			ticks={options.ticks}
			series={[
				{ key: "served", label: "served", color: "var(--color-success)" },
				{ key: "failed", label: "failed", color: "var(--color-destructive)" },
			]}
			data={options.days.map((d) => ({
				label: d.label,
				values: { served: d.served, failed: d.failed },
			}))}
		/>
	);
}

/**
 * **Work p50, a day** — its own chart, never a second axis on the runs chart,
 * with each version's publish marked.
 */
export function PlanTrendWidget({
	options,
}: PanelRendererProps<PlanTrendOptions>) {
	const top = Math.max(1, ...options.values.map((v) => v ?? 0));
	return (
		<LineChart
			values={options.values}
			labels={options.labels}
			ticks={options.ticks}
			marks={options.marks}
			max={top}
			gridlines={[0, top]}
			format={(ms) => (ms <= 0 ? "0" : formatElapsed(Math.round(ms)))}
		/>
	);
}

export const PLAN_CHART_WIDGETS = {
	dailyRuns: DailyRunsWidget,
	workTrend: PlanTrendWidget,
};
