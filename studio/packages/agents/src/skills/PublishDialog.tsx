/**
 * Publish the draft — one dialog for the head and the Evals tab, through the
 * eval gate with the reason History keeps. A failed hard check refuses and
 * names the case; a warning needs the reason; the dialog never predicts the
 * gate, it shows what the engine answered.
 */

import { GatedActDialog } from "../evals/GatedActDialog";
import { useEvalMutations } from "../evals/queries";
import { usePublishSkillVersionMutation } from "./queries";
import type { SkillPage } from "./useSkillPage";

/** The version a publish makes. */
export const nextVersion = (page: SkillPage) =>
	page.draft?.version.version ?? page.skill.version + 1;

export function PublishDialog({
	page,
	open,
	onClose,
	onPublished,
	initialWhy,
}: {
	page: SkillPage;
	open: boolean;
	onClose: () => void;
	onPublished: () => void;
	initialWhy?: string;
}) {
	const { username, graphSlug, skill } = page;
	const publish = usePublishSkillVersionMutation(username, graphSlug);
	const evals = useEvalMutations(username, graphSlug, "skill", skill.id);
	const next = nextVersion(page);

	return (
		<GatedActDialog
			open={open}
			title={`Publish v${next} of ${skill.name}`}
			description="The plan regenerates from this text. Each bound agent uses the new version on its next run; a run in flight finishes on the old."
			confirm={`Publish v${next}`}
			initialWhy={initialWhy}
			pending={publish.isPending}
			error={publish.error}
			onConfirm={(why) =>
				publish.mutate(
					{ id: skill.id, data: { why } },
					{ onSuccess: onPublished },
				)
			}
			onClose={() => {
				publish.reset();
				onClose();
			}}
			onRunEvals={() =>
				evals.open.mutate(
					{ side: "both", trigger: "publish" },
					{ onSuccess: () => publish.reset() },
				)
			}
			runningEvals={evals.open.isPending}
		/>
	);
}
