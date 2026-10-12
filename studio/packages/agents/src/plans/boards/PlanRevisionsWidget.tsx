/**
 * **Revisions in runs** — the plan page's tab for runs that replanned.
 *
 * *As a builder, I want to see what a replan did to one run, so that I can
 * tell a plan that is wrong from a run that met something the plan did not
 * expect.*
 *
 * Pick one of the plan's runs that replanned; the base plan's steps are read
 * against the steps that run ran: **run**, **added by a replan**, **not run**.
 * The engine keeps a run's revision count, not each revision's steps, so this
 * draws what the run ran — never r1 · r2 · r3 — and a replan changes that run
 * only. Each run's trace is read with the run board's own query key, so
 * opening the run afterwards paints from cache.
 */

import type { PanelRendererProps } from "@invana/boards";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@invana/forms";
import {
	Badge,
	EmptyState,
	Spinner,
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@invana/ui";
import { traceApi } from "@invana-studio/core";
import { PanelSection } from "@invana-studio/ui";
import { useQueries } from "@tanstack/react-query";
import { GitBranch } from "lucide-react";
import { useState } from "react";

export interface PlanRevisionsOptions {
	username: string;
	graphSlug: string;
	version: number;
	/** The base plan's step keys, in plan order. */
	steps: { key: string; label: string }[];
	/** The window's runs; only those that replanned are offered. */
	runs: { run_id: string; when: string; asked: string }[];
}

type Standing = "run" | "added by a replan" | "not run";

const VARIANT: Record<Standing, "secondary" | "default" | "outline"> = {
	run: "secondary",
	"added by a replan": "default",
	"not run": "outline",
};

export function PlanRevisionsWidget({
	options,
}: PanelRendererProps<PlanRevisionsOptions>) {
	const { username, graphSlug, steps, runs, version } = options;
	const traces = useQueries({
		queries: runs.map((r) => ({
			queryKey: ["runs", username, graphSlug, r.run_id, "trace"] as const,
			queryFn: () => traceApi.get(username, graphSlug, r.run_id),
		})),
	});
	const loading = traces.some((t) => t.isLoading);
	const replanned = runs
		.map((r, i) => ({ row: r, trace: traces[i]?.data }))
		.filter((r) => (r.trace?.replans ?? 0) > 0);
	const [picked, setPicked] = useState<string | null>(null);
	const shown =
		replanned.find((r) => r.row.run_id === picked) ?? replanned[0] ?? null;

	if (loading) return <Spinner />;
	if (!shown)
		return (
			<EmptyState
				icon={<GitBranch className="size-6" />}
				title="No run replanned"
				description={`Every run in this window ran v${version} as written. A replan shows here when one changes a run's steps.`}
			/>
		);

	const ran = new Map(
		(shown.trace?.steps ?? [])
			.filter((s) => s.step_key)
			.map((s) => [s.step_key as string, s.label]),
	);
	const base = new Set(steps.map((s) => s.key));
	const rows: { key: string; label: string; standing: Standing }[] = [
		...steps.map((s) => ({
			key: s.key,
			label: s.label,
			standing: (ran.has(s.key) ? "run" : "not run") as Standing,
		})),
		...[...ran]
			.filter(([k]) => !base.has(k))
			.map(([key, label]) => ({
				key,
				label,
				standing: "added by a replan" as Standing,
			})),
	];

	return (
		<PanelSection
			title="Revisions in runs"
			hint={`A replan changes this run only. The plan stays v${version} until its instructions change.`}
			action={
				<Select value={shown.row.run_id} onValueChange={setPicked}>
					<SelectTrigger aria-label="Run">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						{replanned.map((r) => (
							<SelectItem key={r.row.run_id} value={r.row.run_id}>
								{new Date(r.row.when).toLocaleString()} · {r.trace?.replans}{" "}
								replan
								{r.trace?.replans === 1 ? "" : "s"}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			}
		>
			<Table bordered={false} density="compact">
				<TableHeader>
					<TableRow>
						<TableHead>Step</TableHead>
						<TableHead className="w-full">What it does</TableHead>
						<TableHead>In this run</TableHead>
					</TableRow>
				</TableHeader>
				<TableBody>
					{rows.map((r) => (
						<TableRow key={r.key}>
							<TableCell className="font-mono">{r.key}</TableCell>
							<TableCell>{r.label}</TableCell>
							<TableCell>
								<Badge variant={VARIANT[r.standing]}>{r.standing}</Badge>
							</TableCell>
						</TableRow>
					))}
				</TableBody>
			</Table>
		</PanelSection>
	);
}
