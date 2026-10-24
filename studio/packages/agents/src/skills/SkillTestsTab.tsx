/**
 * A skill › **Tests** — *Run a test* asks one question of the draft (or the
 * head when no draft is open) as a real run marked **test**, paid from the
 * eval budget. The runs list newest first with the engine's own tokens, duration and outcome.
 */

import { Input } from "@invana/forms";
import {
	Badge,
	Button,
	EmptyState,
	Spinner,
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
	TypographyInlineCode,
} from "@invana/ui";
import { formatDuration, formatRelativeTime } from "@invana-studio/core";
import { ActButton } from "@invana-studio/shell";
import { FormError, PanelSection } from "@invana-studio/ui";
import { Play } from "lucide-react";
import { useState } from "react";
import { useSkillTestsQuery, useStartSkillTestMutation } from "./queries";
import { useSkillOpen } from "./skillOpen";
import type { SkillTestRead } from "./types";
import type { SkillPage } from "./useSkillPage";

export function SkillTestsTab({ page }: { page: SkillPage }) {
	const { username, graphSlug, skill } = page;
	const tests = useSkillTestsQuery(username, graphSlug, skill.id);
	const start = useStartSkillTestMutation(username, graphSlug, skill.id);
	const [question, setQuestion] = useState("");
	const rows = tests.data?.items ?? [];

	return (
		<div className="flex flex-col gap-2.5 p-3.5">
			<form
				className="flex flex-wrap items-center gap-2"
				onSubmit={(e) => {
					e.preventDefault();
					const q = question.trim();
					if (q) start.mutate(q, { onSuccess: () => setQuestion("") });
				}}
			>
				<Input
					aria-label="Test question"
					className="min-w-64 flex-1"
					value={question}
					maxLength={4000}
					onChange={(e) => setQuestion(e.target.value)}
					placeholder="A question to test it on — e.g. Audit LHR"
				/>
				<ActButton
					area="build"
					size="sm"
					type="submit"
					disabled={!question.trim() || start.isPending}
				>
					<Play /> {start.isPending ? "Starting…" : "Run a test"}
				</ActButton>
				<span className="w-full text-sm text-muted-foreground">
					A real run of the {page.hasDraft ? "draft" : "published version"},
					marked test.
				</span>
			</form>
			<FormError error={start.error as Error | null} />
			{tests.isLoading ? (
				<Spinner />
			) : tests.error ? (
				<EmptyState
					className="py-6"
					title="The test runs did not load"
					description={(tests.error as Error).message}
				/>
			) : rows.length === 0 ? (
				<EmptyState
					className="py-6"
					title="Not run yet"
					description="Ask it a question above; each test is a real run, marked test."
				/>
			) : (
				<TestRunsTable rows={rows} />
			)}
		</div>
	);
}

/** The test runs, newest first — also under the document on Instructions. */
export function TestRunsTable({ rows }: { rows: SkillTestRead[] }) {
	const open = useSkillOpen();
	return (
		<PanelSection card title="Tests" hint={`${rows.length}`}>
			<Table bordered={false} density="compact">
				<TableHeader>
					<TableRow>
						<TableHead>Run</TableHead>
						<TableHead className="w-full">Question</TableHead>
						<TableHead>Tokens</TableHead>
						<TableHead>Time</TableHead>
						<TableHead>Outcome</TableHead>
						<TableHead>Finished</TableHead>
						<TableHead />
					</TableRow>
				</TableHeader>
				<TableBody>
					{rows.map((t) => (
						<TableRow key={t.id}>
							<TableCell>
								<TypographyInlineCode>{t.id.slice(0, 8)}</TypographyInlineCode>
							</TableCell>
							<TableCell>{t.question}</TableCell>
							<TableCell className="whitespace-nowrap font-mono">
								{t.tokens.toLocaleString()}
							</TableCell>
							<TableCell className="whitespace-nowrap font-mono">
								{t.duration_ms == null ? "—" : formatDuration(t.duration_ms)}
							</TableCell>
							<TableCell className="whitespace-nowrap">
								<Badge
									size="xs"
									variant="outline"
									tone={
										t.outcome === "answered"
											? "success"
											: t.outcome
												? "muted"
												: undefined
									}
								>
									{(t.outcome ?? t.status).replaceAll("_", " ")}
								</Badge>
							</TableCell>
							<TableCell className="whitespace-nowrap text-muted-foreground">
								{t.finished_at
									? formatRelativeTime(new Date(t.finished_at))
									: "running"}
							</TableCell>
							<TableCell>
								{open ? (
									<Button
										size="xs"
										variant="link"
										onClick={() => open.run(t.id)}
									>
										open run
									</Button>
								) : null}
							</TableCell>
						</TableRow>
					))}
				</TableBody>
			</Table>
		</PanelSection>
	);
}
