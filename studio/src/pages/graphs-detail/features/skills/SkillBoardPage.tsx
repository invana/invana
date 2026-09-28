/**
 * The skill's page, as a page in `mainSection` (SK17 · SK36) — `skill:<id>`
 * on the strip, the Skills list left beside it in `leftSection`.
 *
 * This is the host half: which skill, and whether its Playbook is being
 * edited. {@link SkillDetail} is the page itself.
 */

import { EmptyState, Spinner } from "@invana/ui";
import { useState } from "react";
import { useSkillsQuery } from "@/pages/graphs-detail/features/skills/queries";
import { SkillDetail } from "@/pages/graphs-detail/features/skills/SkillDetail";

export function SkillBoardPage({
	username,
	graphSlug,
	skillId,
	onOpenAgent,
	onOpenUsageDashboard,
}: {
	username: string;
	graphSlug: string;
	skillId: string;
	onOpenAgent: (agentId: string) => void;
	onOpenUsageDashboard: (skillId: string) => void;
}) {
	// The same list the section reads, so the page and the row never disagree
	// about version or draft.
	const skills = useSkillsQuery(username, graphSlug);
	const [editing, setEditing] = useState(false);
	const skill = skills.data?.items.find((s) => s.id === skillId) ?? null;

	if (skills.isLoading)
		return (
			<div className="flex h-full items-center justify-center">
				<Spinner />
			</div>
		);
	if (!skill)
		return (
			<EmptyState
				className="h-full"
				title="This skill is not in the Graph"
				description="It may have been deleted. Close this page, or pick a skill in the Skills list."
			/>
		);

	return (
		<SkillDetail
			username={username}
			graphSlug={graphSlug}
			skill={skill}
			// A draft has nothing to read yet, so it opens editing (SK37).
			editing={editing || skill.is_draft}
			onEditing={setEditing}
			onOpenAgent={onOpenAgent}
			onOpenUsageDashboard={onOpenUsageDashboard}
		/>
	);
}
