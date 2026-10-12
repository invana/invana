/**
 * **A simulation's result** — the drill-in `simulation=<n>` of a project's
 * page (simulation.md, board `projects.simulate.result`).
 *
 * The header names what ran and how: the simulator and its version, the run's
 * status, `derived` — every simulation's output is — and a sub line with the
 * branch, crosses × progeny when the summary gives them, how many dataset
 * versions it read, how long it took, its tokens and its seed. Its acts are
 * *Open run page* — a simulation is a run, with the run's own trace — and,
 * once it has succeeded, *Save as dataset*.
 *
 * While the run has not settled the page says so and the query reads again
 * every 2 s; a failed run shows the simulator's sentence. The table reads the
 * ranked contract, not a crop: the row label, the share meeting every target
 * as a bar, each trait's `mean ± sd` and share meeting it, then any other
 * plain figure. Each row can become a finding on the simulation's branch,
 * citing its run.
 */

import {
	Alert,
	AlertDescription,
	AlertTitle,
	Badge,
	Button,
	Progress,
	RecordHeader,
	RunStatusText,
	Spinner,
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@invana/ui";
import { Database, ExternalLink, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { AddFindingDialog } from "../project/AddFindingDialog";
import { Box, Muted, Page, ReadState } from "../project/parts";
import { simulationPending, useSimulationQuery } from "../records/queries";
import { branchLabel, plural } from "../records/words";
import type { Cite, Project, RankedRow, Simulation } from "../types";
import { SaveAsDatasetDialog } from "./SaveAsDatasetDialog";
import {
	duration,
	figure,
	pct,
	plainKeys,
	rowLabelKey,
	traitNames,
} from "./specForm";

type Tone = "success" | "warning" | "destructive" | "info" | "muted";

/** A run status as a badge tone. */
function simulationTone(status: string | null): Tone {
	if (status === "succeeded") return "success";
	if (status === "failed") return "destructive";
	if (status === "cancelled") return "muted";
	return "info";
}

/** `H2 · 4 crosses × 2,000 progeny · read 3 dataset versions · 41 s · 0 tokens · seed 123`. */
function subLine(project: Project, s: Simulation): string {
	const sum = s.result?.summary ?? {};
	const crosses = typeof sum.crosses === "number" ? sum.crosses : null;
	const progeny = typeof sum.progeny === "number" ? sum.progeny : null;
	return [
		branchLabel(project, s.branch),
		crosses !== null && progeny !== null
			? `${plural(crosses, "cross", "crosses")} × ${progeny.toLocaleString()} progeny`
			: null,
		`read ${plural(s.inputs.length, "dataset version")}`,
		duration(s.started_at, s.finished_at),
		plural(s.tokens, "token"),
		`seed ${s.seed}`,
	]
		.filter(Boolean)
		.join(" · ");
}

export function SimulationView({
	username,
	graphSlug,
	project,
	number,
	onOpenRun,
	onOpenDataset,
}: {
	username: string;
	graphSlug: string;
	project: Project;
	number: number;
	onOpenRun?: (runId: string) => void;
	onOpenDataset?: (address: string) => void;
}) {
	const refKey = { username, graphSlug, key: project.key };
	const q = useSimulationQuery(refKey, number);
	const [saving, setSaving] = useState(false);
	const [finding, setFinding] = useState<{
		statement: string;
		cites: Cite[];
	} | null>(null);

	const s = q.data;
	if (!s)
		return (
			<Page>
				<ReadState loading={q.isLoading} error={q.error} />
			</Page>
		);

	const pending = simulationPending(s.status);
	const status = s.status ?? "queued";

	return (
		<Page>
			<RecordHeader
				crumbs={[`Simulation s${s.number} · ${s.simulator.title}`]}
				chips={
					<>
						<Badge variant="soft" tone="info" size="xs">
							derived
						</Badge>
						<Badge variant="outline" tone="muted" size="xs">
							{s.simulator.title} · v{s.simulator.version}
						</Badge>
						<Badge variant="soft" tone={simulationTone(s.status)} size="xs">
							{status}
						</Badge>
					</>
				}
				actions={
					<>
						{s.run_id && onOpenRun ? (
							<Button
								variant="ghost"
								size="sm"
								onClick={() => onOpenRun(s.run_id as string)}
							>
								<ExternalLink />
								Open run page
							</Button>
						) : null}
						{s.status === "succeeded" ? (
							<Button
								variant="outline"
								size="sm"
								onClick={() => setSaving(true)}
							>
								<Database />
								Save as dataset
							</Button>
						) : null}
					</>
				}
			/>
			<p className="px-4 pt-2 text-sm text-muted-foreground">
				{subLine(project, s)}
			</p>

			<div className="flex flex-col gap-3 p-3">
				{pending ? (
					<div className="flex items-center gap-2 text-sm text-muted-foreground">
						<Spinner />
						<span>
							The simulation is <RunStatusText status={status} /> — the result
							lands here when its run settles.
						</span>
					</div>
				) : null}
				{s.status === "failed" || s.status === "cancelled" ? (
					<Alert variant="destructive">
						<AlertTitle>
							{s.status === "failed"
								? "The simulation failed"
								: "The simulation was cancelled"}
						</AlertTitle>
						<AlertDescription>
							{s.error ?? "Its run says why on the run page."}
						</AlertDescription>
					</Alert>
				) : null}
				{s.result ? (
					<Box
						title="Ranked"
						count={s.result.ranked.length}
						actions={
							<span className="text-sm text-muted-foreground">
								by the share meeting every target
							</span>
						}
					>
						<RankedTable
							rows={s.result.ranked}
							onAddFinding={(statement) =>
								setFinding({
									statement,
									cites: s.run_id ? [{ kind: "run", ref: s.run_id }] : [],
								})
							}
						/>
					</Box>
				) : null}
				<Muted>
					Predictions, not observations: saved datasets carry origin derived and
					the inputs they were computed from.
				</Muted>
				<Box title="Inputs" count={s.inputs.length}>
					{s.inputs.length === 0 ? (
						<Muted>It read no dataset version.</Muted>
					) : (
						<ul className="flex flex-col gap-1 px-3 py-2">
							{s.inputs.map((i) => (
								<li
									key={i.version_id}
									className="flex items-center justify-between gap-2 text-sm"
								>
									<span className="truncate font-mono">{i.ref}</span>
									<span className="font-mono text-muted-foreground">
										{i.content_hash.slice(0, 12)}
									</span>
								</li>
							))}
						</ul>
					)}
				</Box>
			</div>

			<AddFindingDialog
				open={finding !== null}
				onClose={() => setFinding(null)}
				username={username}
				graphSlug={graphSlug}
				fixed={{ project, branch: s.branch }}
				initial={finding ?? undefined}
				from={`from simulation s${s.number}`}
				evidence="Cites the simulation's run — its inputs, spec and seed are on the run."
			/>
			{s.status === "succeeded" ? (
				<SaveAsDatasetDialog
					open={saving}
					onClose={() => setSaving(false)}
					project={project}
					refKey={refKey}
					simulation={s}
					onOpenDataset={onOpenDataset}
				/>
			) : null}
		</Page>
	);
}

/** The ranked rows, by contract: label · meets every target · traits · plain figures. */
function RankedTable({
	rows,
	onAddFinding,
}: {
	rows: RankedRow[];
	onAddFinding: (statement: string) => void;
}) {
	const { label, traits, plain } = useMemo(() => {
		const label = rowLabelKey(rows);
		return {
			label,
			traits: traitNames(rows),
			plain: plainKeys(rows, label, ["female", "male"]),
		};
	}, [rows]);
	if (rows.length === 0) return <Muted>The simulator ranked nothing.</Muted>;
	return (
		<Table>
			<TableHeader>
				<TableRow>
					<TableHead>{label}</TableHead>
					<TableHead>meets every target</TableHead>
					{traits.map((t) => (
						<TableHead key={t}>{t}</TableHead>
					))}
					{plain.map((k) => (
						<TableHead key={k}>{k}</TableHead>
					))}
					<TableHead />
				</TableRow>
			</TableHeader>
			<TableBody>
				{rows.map((r, i) => {
					const name = String(r[label] ?? i + 1);
					const all = pct(r.meets_all);
					return (
						<TableRow key={name}>
							<TableCell className="font-mono">{name}</TableCell>
							<TableCell>
								<div className="flex items-center gap-2">
									<Progress
										value={all}
										size="sm"
										className="w-32"
										aria-label={`${name} meets every target`}
									/>
									<span className="tabular-nums">{all}%</span>
								</div>
							</TableCell>
							{traits.map((t) => {
								const f = r.traits?.[t];
								return (
									<TableCell key={t} className="tabular-nums">
										{f ? (
											<div className="flex flex-col">
												<span>
													{figure(f.mean)}
													{f.sd !== undefined ? ` ± ${figure(f.sd)}` : ""}
												</span>
												{f.meets !== undefined ? (
													<span className="text-sm text-muted-foreground">
														meets {pct(f.meets)}%
													</span>
												) : null}
											</div>
										) : (
											"—"
										)}
									</TableCell>
								);
							})}
							{plain.map((k) => {
								const v = r[k];
								return (
									<TableCell key={k} className="tabular-nums">
										{typeof v === "number" ? figure(v) : String(v ?? "—")}
									</TableCell>
								);
							})}
							<TableCell className="text-right">
								<Button
									variant="outline"
									size="sm"
									onClick={() =>
										onAddFinding(
											`${name}: ${all}% of progeny meet every target`,
										)
									}
								>
									<Plus />
									Add finding
								</Button>
							</TableCell>
						</TableRow>
					);
				})}
			</TableBody>
		</Table>
	);
}
