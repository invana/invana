/**
 * A skill › **Tests** — *Run a test* asks one question of the draft (or the
 * head when no draft is open) as a real run marked **test**, paid from the
 * eval budget. The runs list newest first with the engine's own tokens,
 * duration and outcome — the same form and table as the console under the
 * Instructions document.
 */

import { EmptyState, Spinner } from "@invana/ui";
import { PanelSection } from "@invana-studio/ui";
import { TestQuestionForm, TestRunsTable } from "./console/TestRuns";
import { useSkillTestsQuery } from "./queries";
import type { SkillPage } from "./useSkillPage";

export function SkillTestsTab({ page }: { page: SkillPage }) {
	const { username, graphSlug, skill } = page;
	const tests = useSkillTestsQuery(username, graphSlug, skill.id);
	const rows = tests.data?.items ?? [];

	return (
		<div className="flex flex-col gap-2.5 p-3.5">
			<TestQuestionForm page={page} />
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
				<PanelSection card title="Tests" hint={`${rows.length}`}>
					<TestRunsTable rows={rows} />
				</PanelSection>
			)}
		</div>
	);
}
