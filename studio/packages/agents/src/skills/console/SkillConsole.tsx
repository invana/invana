/**
 * The console under a skill's Instructions document — where a test run lands
 * while the person stays on the text it tests. Four tabs, the kit's
 * `TabbedPanel`:
 *
 * | Tab | What it lists |
 * |---|---|
 * | **Tests** | *Run a test*, then the test runs, newest first |
 * | **Evals** | the eval runs, newest first: the draft's hard checks passed and the gate's verdict, as the engine summarised them |
 * | **Problems** | what keeps the draft from publishing: a line no function maps, the planner's open question, the draw's refusal |
 * | **Log** | the draw's state and each test run's status, newest first |
 *
 * Each tab's count is the length of a list that is fully on screen. The
 * strip's last action folds the console to its tabs and back.
 */

import {
	Badge,
	EmptyState,
	Spinner,
	TabbedPanel,
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
	TypographyInlineCode,
} from "@invana/ui";
import { formatShortDateTime } from "@invana-studio/core";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronUp } from "lucide-react";
import { type ReactNode, useState } from "react";
import { evalsApi } from "../../evals/api";
import { useSkillTestsQuery } from "../queries";
import type { SkillPage } from "../useSkillPage";
import { TestQuestionForm, TestRunsTable } from "./TestRuns";

type ConsoleTab = "tests" | "evals" | "problems" | "log";

const when = (at: string | null) =>
	at ? formatShortDateTime(new Date(at)) : "running";

export function SkillConsole({ page }: { page: SkillPage }) {
	const { username, graphSlug, skill } = page;
	const [tab, setTab] = useState<ConsoleTab>("tests");
	const [folded, setFolded] = useState(false);
	const tests = useSkillTestsQuery(username, graphSlug, skill.id);
	// The Evals tab's own key, so a run opened there re-reads this list too.
	const evalRuns = useQuery({
		queryKey: ["evals", username, graphSlug, "skill", skill.id, "runs"],
		queryFn: () => evalsApi.runs(username, graphSlug, "skill", skill.id),
	});
	const testRows = tests.data?.items ?? [];
	const evalRows = evalRuns.data ?? [];
	const problems = problemsOf(page);

	const label = (name: string, count?: number) => (
		<span className="inline-flex items-center gap-1.5">
			{name}
			{count === undefined ? null : (
				<span className="text-muted-foreground tabular-nums">{count}</span>
			)}
		</span>
	);

	return (
		<TabbedPanel
			className="h-auto"
			bodyClassName={folded ? "hidden" : "max-h-80"}
			activeTab={tab}
			onTabChange={(v) => {
				setTab(v as ConsoleTab);
				setFolded(false);
			}}
			headerActions={[
				{
					name: folded ? "Open the console" : "Fold the console",
					icon: folded ? ChevronUp : ChevronDown,
					onClick: () => setFolded((f) => !f),
				},
			]}
			tabs={[
				{
					value: "tests",
					name: "Tests",
					label: label("Tests", testRows.length),
					content: (
						<div className="flex flex-col gap-2 p-2.5">
							<TestQuestionForm page={page} />
							<Loaded
								loading={tests.isLoading}
								error={tests.error}
								what="The test runs"
								empty={testRows.length === 0}
								emptyText="Not run yet — ask it a question; each test is a real run, marked test."
							>
								<TestRunsTable rows={testRows} />
							</Loaded>
						</div>
					),
				},
				{
					value: "evals",
					name: "Evals",
					label: label("Evals", evalRows.length),
					content: (
						<Loaded
							loading={evalRuns.isLoading}
							error={evalRuns.error}
							what="The eval runs"
							empty={evalRows.length === 0}
							emptyText="Not run yet — the Evals tab replays the set on the draft against live."
						>
							<Table bordered={false} density="compact">
								<TableHeader>
									<TableRow>
										<TableHead>Run</TableHead>
										<TableHead className="w-full">Draft</TableHead>
										<TableHead>Gate</TableHead>
										<TableHead>Finished</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{evalRows.map((r) => {
										const draft = r.result?.eval?.sides.draft;
										const gate = r.result?.eval?.gate.verdict;
										return (
											<TableRow key={r.id}>
												<TableCell>
													<TypographyInlineCode>
														{r.id.slice(0, 8)}
													</TypographyInlineCode>
												</TableCell>
												<TableCell>
													{draft
														? `${draft.hard_passed} of ${draft.hard_total} hard checks passed · ${draft.cases} case${draft.cases === 1 ? "" : "s"}`
														: r.detail || r.status.replaceAll("_", " ")}
												</TableCell>
												<TableCell>
													{gate ? (
														<Badge
															size="xs"
															variant="outline"
															tone={
																gate === "clean"
																	? "success"
																	: gate === "warn"
																		? "warning"
																		: "destructive"
															}
														>
															{gate}
														</Badge>
													) : (
														"—"
													)}
												</TableCell>
												<TableCell className="whitespace-nowrap text-muted-foreground">
													{when(r.finished_at)}
												</TableCell>
											</TableRow>
										);
									})}
								</TableBody>
							</Table>
						</Loaded>
					),
				},
				{
					value: "problems",
					name: "Problems",
					label: label("Problems", problems.length),
					content: problems.length ? (
						<ul className="flex flex-col divide-y px-2.5">
							{problems.map((p) => (
								<li key={p.key} className="flex items-start gap-2 py-1.5">
									<span className="w-14 shrink-0 font-mono text-sm text-muted-foreground">
										{p.line ? `line ${p.line}` : "—"}
									</span>
									<span className="min-w-0 flex-1">{p.text}</span>
									<Badge size="xs" variant="soft" tone={p.tone}>
										{p.kind}
									</Badge>
								</li>
							))}
						</ul>
					) : (
						<EmptyState
							className="py-4"
							title="No problems"
							description="Every line maps to a function this skill may use."
						/>
					),
				},
				{
					value: "log",
					name: "Log",
					label: label("Log"),
					content: (
						<ul className="flex flex-col divide-y px-2.5 font-mono text-sm">
							<li className="py-1.5">
								{page.drawing
									? "drawing the plan…"
									: page.draft
										? page.draft.drawn
											? `plan drawn from v${page.planVersion}`
											: "the saved text is not drawn yet"
										: `v${skill.version} · published`}
							</li>
							{testRows.map((t) => (
								<li key={t.id} className="flex gap-2 py-1.5">
									<span className="text-muted-foreground">
										{when(t.finished_at)}
									</span>
									<span>
										test {t.id.slice(0, 8)} ·{" "}
										{(t.outcome ?? t.status).replaceAll("_", " ")}
									</span>
								</li>
							))}
						</ul>
					),
				},
			]}
		/>
	);
}

/** A tab's list once it loaded: a spinner, the error, the empty line, or it. */
function Loaded({
	loading,
	error,
	what,
	empty,
	emptyText,
	children,
}: {
	loading: boolean;
	error: unknown;
	what: string;
	empty: boolean;
	emptyText: string;
	children: ReactNode;
}) {
	if (loading)
		return (
			<div className="flex justify-center p-4">
				<Spinner />
			</div>
		);
	if (error)
		return (
			<EmptyState
				className="py-4"
				title={`${what} did not load`}
				description={error instanceof Error ? error.message : undefined}
			/>
		);
	if (empty) return <p className="p-2.5 text-muted-foreground">{emptyText}</p>;
	return children;
}

interface Problem {
	key: string;
	line: number | null;
	text: string;
	kind: string;
	tone: "destructive" | "warning";
}

/** What keeps the draft from publishing, in the order the text reads. */
function problemsOf(page: SkillPage): Problem[] {
	const open = page.draft?.open_clarification;
	const refusal = page.draft?.refusal;
	return [
		...page.unmapped.map((span) => ({
			key: `u:${span}`,
			line: page.lineOf(span),
			text: `“${span}”`,
			kind: "no function",
			tone: "destructive" as const,
		})),
		...(open
			? [
					{
						key: `q:${open.id}`,
						line: page.lineOf(open.span),
						text: open.question,
						kind: "question",
						tone: "warning" as const,
					},
				]
			: []),
		...(refusal && !page.drawing
			? refusal.reasons.map((r) => ({
					key: `r:${r}`,
					line: null,
					text: r,
					kind: "refused",
					tone: "destructive" as const,
				}))
			: []),
	].sort((a, b) => (a.line ?? Infinity) - (b.line ?? Infinity));
}
