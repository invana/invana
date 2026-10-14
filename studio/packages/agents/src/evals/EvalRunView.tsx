/**
 * One eval run, read: the draft replayed against live on the subject's fixed
 * questions (board `agents.skills.evals`).
 *
 * Tiles first — questions, hard checks passed, answers changed, p95 and
 * tokens per run, each draft against live — then one row per question with
 * both sides and the checks the draft side passed or failed. A judged score,
 * where there is one, is labelled and never added to the hard checks.
 */

import {
	Badge,
	MetricGrid,
	MetricTile,
	Spinner,
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@invana/ui";
import { PanelSection } from "@invana-studio/ui";
import { isSettled } from "./queries";
import type { EvalCase, EvalResult, EvalRun, EvalSide } from "./types";

const seconds = (ms: number | null | undefined) =>
	ms == null ? "—" : `${(ms / 1000).toFixed(1)}s`;

/** `▲ 11% vs live` — the draft's change, or nothing when there is no live side. */
function versus(draft?: number | null, live?: number | null): string {
	if (draft == null || live == null || live === 0) return "no live side";
	const pct = Math.round(((draft - live) / live) * 100);
	if (pct === 0) return "same as live";
	return `${pct > 0 ? "▲" : "▼"} ${Math.abs(pct)}% vs live`;
}

const perRun = (side?: EvalSide) =>
	side && side.cases > 0 ? Math.round(side.tokens / side.cases) : null;

function sideCell(r?: EvalResult) {
	if (!r) return "—";
	return `${seconds(r.latency_ms)} · ${r.tokens.toLocaleString()} tokens`;
}

export function EvalRunView({
	run,
	cases,
}: {
	run: EvalRun | undefined;
	cases: EvalCase[];
}) {
	if (!run) return <Spinner />;
	if (!isSettled(run))
		return (
			<PanelSection card title="Evals" hint={run.detail || "replaying the set"}>
				<Spinner />
			</PanelSection>
		);

	const summary = run.result?.eval;
	const live = summary?.sides.live;
	const draft = summary?.sides.draft ?? live;
	const results = run.results ?? [];
	const byCase = new Map<string, { live?: EvalResult; draft?: EvalResult }>();
	for (const r of results) {
		const row = byCase.get(r.eval_case_id) ?? {};
		row[r.side] = r;
		byCase.set(r.eval_case_id, row);
	}
	const verdict = summary?.gate.verdict;

	return (
		<div className="flex flex-col gap-3">
			<MetricGrid columns={5}>
				<MetricTile
					label="Questions"
					value={draft?.cases ?? 0}
					caption={`eval set · ${cases.length} cases`}
				/>
				<MetricTile
					label="Checks passed"
					value={`${draft?.hard_passed ?? 0} of ${draft?.hard_total ?? 0}`}
					tone={verdict === "blocked" ? "error" : "success"}
					caption={
						verdict === "blocked" ? "a hard check failed" : "hard checks"
					}
				/>
				<MetricTile
					label="Answers changed"
					value={summary?.changed_answers ?? 0}
					caption="draft against live"
				/>
				<MetricTile
					label="p95"
					value={seconds(draft?.p95_ms)}
					caption={versus(draft?.p95_ms, live?.p95_ms)}
					captionTone={verdict === "warn" ? "warning" : undefined}
				/>
				<MetricTile
					label="Tokens / run"
					value={perRun(draft)?.toLocaleString() ?? "—"}
					caption={versus(perRun(draft), perRun(live))}
				/>
			</MetricGrid>

			{summary && summary.gate.reasons.length > 0 ? (
				<PanelSection card title="The gate" hint={verdict}>
					<ul>
						{summary.gate.reasons.map((r) => (
							<li key={r}>{r}</li>
						))}
					</ul>
				</PanelSection>
			) : null}

			<PanelSection card title="Eval set" hint={`${byCase.size} questions`}>
				<Table bordered={false} density="compact">
					<TableHeader>
						<TableRow>
							<TableHead className="w-full">Question</TableHead>
							<TableHead>Live</TableHead>
							<TableHead>Draft</TableHead>
							<TableHead>Checks</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{cases
							.filter((c) => byCase.has(c.id))
							.map((c) => {
								const row = byCase.get(c.id) ?? {};
								const checked = row.draft ?? row.live;
								return (
									<TableRow key={c.id}>
										<TableCell>{c.question}</TableCell>
										<TableCell className="whitespace-nowrap font-mono">
											{sideCell(row.live)}
										</TableCell>
										<TableCell className="whitespace-nowrap font-mono">
											{sideCell(row.draft)}
										</TableCell>
										<TableCell>
											<span className="flex flex-wrap gap-1">
												{Object.entries(checked?.hard ?? {}).map(
													([kind, verdict]) => (
														<Badge
															key={kind}
															size="xs"
															variant="soft"
															tone={
																verdict === "pass" ? "success" : "destructive"
															}
														>
															{verdict === "pass" ? "✓" : "✗"}{" "}
															{kind.replaceAll("_", " ")}
														</Badge>
													),
												)}
												{checked?.judged != null ? (
													<Badge size="xs" variant="outline">
														judged {checked.judged}/5
													</Badge>
												) : null}
											</span>
										</TableCell>
									</TableRow>
								);
							})}
					</TableBody>
				</Table>
			</PanelSection>
		</div>
	);
}
