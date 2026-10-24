/**
 * The skill's page, as a page in `mainSection` — `skill:<id>` on the workbook
 * strip, opened from a row of the Skills list or any opener that names a skill.
 * Agents has no `leftSection`: the page fills `mainSection`, and its crumb leads
 * back to the Skills list.
 *
 * This is the host half: which skill. {@link SkillDetail} is the page itself.
 * While the list loads the page draws nothing but a spinner; a skill that is
 * not in the Graph says so.
 */

import { EmptyState, Spinner } from "@invana/ui";
import { EVERY } from "../lists";
import { useSkillsQuery } from "./queries";
import { SkillDetail } from "./SkillDetail";

export function SkillBoardPage({
	username,
	graphSlug,
	skillId,
	onOpenAgent,
}: {
	username: string;
	graphSlug: string;
	skillId: string;
	onOpenAgent?: (agentId: string) => void;
}) {
	// The same list the section reads, so the page and the row never disagree
	// about version or draft.
	const skills = useSkillsQuery(username, graphSlug, EVERY);
	const skill = skills.data?.items.find((s) => s.id === skillId) ?? null;

	if (skills.isLoading)
		return (
			<div className="flex h-full items-center justify-center">
				<Spinner />
			</div>
		);
	if (skills.error)
		return (
			<EmptyState
				className="h-full"
				title="The skills did not load"
				description={(skills.error as Error).message}
			/>
		);
	if (!skill)
		return (
			<EmptyState
				className="h-full"
				title="This skill is not in the Graph"
				description="It may have been deleted. Close this page, or open a skill from the Skills list."
			/>
		);

	return (
		<SkillDetail
			username={username}
			graphSlug={graphSlug}
			skill={skill}
			onOpenAgent={onOpenAgent}
		/>
	);
}
