/**
 * A skill › **Evals** — the gate's tiles and every case, the draft against
 * live, from the newest eval run; then the eval set itself, and *Publish vN*
 * with the reason History keeps.
 *
 * The tiles and verdicts are the engine's summary of that run. A failed hard
 * check refuses the publish and names the case; a warning takes a reason.
 */

import { Input } from "@invana/forms";
import { Button, EmptyState, Spinner } from "@invana/ui";
import { ActButton } from "@invana-studio/shell";
import { FormError } from "@invana-studio/ui";
import { useQuery } from "@tanstack/react-query";
import { Check, Play, Trash2 } from "lucide-react";
import { useState } from "react";
import { evalsApi } from "../evals/api";
import { EvalRunView } from "../evals/EvalRunView";
import { EvalSetPanel } from "../evals/EvalSetPanel";
import {
	useEvalMutations,
	useEvalRunQuery,
	useEvalSetQuery,
} from "../evals/queries";
import { nextVersion, PublishDialog } from "./PublishDialog";
import { useDiscardDraftMutation } from "./queries";
import { canPublish, type SkillPage } from "./useSkillPage";

export function SkillEvalsTab({
	page,
	onPublished,
}: {
	page: SkillPage;
	onPublished: () => void;
}) {
	const { username, graphSlug, skill } = page;
	const evals = useEvalMutations(username, graphSlug, "skill", skill.id);
	const set = useEvalSetQuery(username, graphSlug, "skill", skill.id);
	const discard = useDiscardDraftMutation(username, graphSlug, skill.id);
	// The newest run, under the set's key so opening a run re-reads it.
	const runs = useQuery({
		queryKey: ["evals", username, graphSlug, "skill", skill.id, "runs"],
		queryFn: () => evalsApi.runs(username, graphSlug, "skill", skill.id),
	});
	const newest = runs.data?.[0]?.id ?? null;
	const run = useEvalRunQuery(username, graphSlug, "skill", skill.id, newest);
	const [why, setWhy] = useState("");
	const [publishing, setPublishing] = useState(false);
	const next = nextVersion(page);

	return (
		<div className="flex flex-col gap-2.5 p-3.5">
			{runs.isLoading ? (
				<Spinner />
			) : newest ? (
				<EvalRunView run={run.data} cases={set.data?.cases ?? []} />
			) : (
				<EmptyState
					className="py-6"
					title="Not run yet"
					description="Run the evals to replay the set on the draft against live."
				/>
			)}

			{page.hasDraft ? (
				<div className="flex flex-wrap items-center gap-2">
					<Input
						aria-label="Why"
						className="w-96"
						value={why}
						maxLength={500}
						onChange={(e) => setWhy(e.target.value)}
						placeholder="Why — kept in History"
					/>
					<span className="ms-auto flex items-center gap-1.5">
						<ActButton
							area="build"
							size="sm"
							variant="outline"
							disabled={evals.open.isPending}
							onClick={() => evals.open.mutate({ side: "both" })}
						>
							<Play /> {evals.open.isPending ? "Opening…" : "Run the evals"}
						</ActButton>
						{skill.is_draft ? null : (
							<ActButton
								area="build"
								size="sm"
								variant="ghost"
								disabled={discard.isPending}
								onClick={() => discard.mutate()}
							>
								<Trash2 /> Discard draft
							</ActButton>
						)}
						<ActButton
							area="build"
							size="sm"
							disabled={!canPublish(page)}
							onClick={() => setPublishing(true)}
						>
							<Check /> Publish v{next}
						</ActButton>
					</span>
				</div>
			) : (
				<p className="text-muted-foreground">
					No draft open — the set below holds the next version to it.{" "}
					<Button size="xs" variant="link" onClick={page.startEditing}>
						Edit instructions
					</Button>
				</p>
			)}
			<FormError error={(evals.open.error ?? discard.error) as Error | null} />

			<EvalSetPanel
				username={username}
				graphSlug={graphSlug}
				kind="skill"
				subjectId={skill.id}
			/>

			<PublishDialog
				page={page}
				open={publishing}
				initialWhy={why}
				onClose={() => setPublishing(false)}
				onPublished={() => {
					setPublishing(false);
					setWhy("");
					onPublished();
				}}
			/>
		</div>
	);
}
