/**
 * The rule board, as a page — artboard `RuleDash`
 * ([34t](../../../../../../docs/for-developers/the-screens.md)).
 *
 * The rule itself is read by id, and the counts from its citations, which is
 * the one read only this page needs ([rules.md](../../../../../../docs/for-developers/modules/skills/features/rules.md)).
 */

import { Board } from "@invana/boards";
import { EmptyState, Spinner } from "@invana/ui";
import { SKILL_ACTIONS } from "@invana-studio/agents";
import { useRuleCitationsQuery, useRuleQuery } from "@invana-studio/core";
import { useReport, VIEW_BOARD } from "@invana-studio/shell";
import { BOARD_ICONS } from "@invana-studio/ui";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ruleBoardSpec } from "@/host/rules/ruleBoardSpec";

export interface RuleBoardPageProps {
	username: string;
	graphSlug: string;
	/** The `rules.id` every panel binds to. */
	ruleId: string;
	/** A citation row — opens the run the citing step came from. */
	onOpenRun?: (runId: string) => void;
}

export function RuleBoardPage({
	username,
	graphSlug,
	ruleId,
	onOpenRun,
}: RuleBoardPageProps) {
	const navigate = useNavigate();
	const rules = useRuleQuery(username, graphSlug, ruleId);
	const rule = rules.data ?? null;
	const citations = useRuleCitationsQuery(username, graphSlug, ruleId);
	const [view, setView] = useState(VIEW_BOARD);

	const spec = useMemo(
		() => (rule ? ruleBoardSpec(rule, citations.data, { view }) : null),
		[rule, citations.data, view],
	);

	// `Save report` on the header, and the act behind it. The document
	// it keeps is `spec` — this page's reading, resolved — never the subject.
	const report = useReport(spec);

	if (rules.isLoading) {
		return (
			<div className="flex h-full items-center justify-center">
				<Spinner />
			</div>
		);
	}
	if (!rule || !spec || !report) {
		return (
			<EmptyState
				className="h-full"
				title="This rule is gone"
				description="A rule has no delete — it is deactivated — so this one was removed with its Graph or its project."
			/>
		);
	}

	return (
		<Board
			className="h-full min-h-0"
			spec={report.spec}
			icons={BOARD_ICONS}
			onAction={(id, ctx) => {
				if (report.handle(id)) return;
				switch (id) {
					case SKILL_ACTIONS.view:
						if (ctx?.option) setView(ctx.option);
						return;
					case SKILL_ACTIONS.edit:
						// `Edit` opens the rule dialog on Modeller › Rules.
						navigate(`/u/${username}/${graphSlug}/modeller/rules/${ruleId}`);
						return;
					case SKILL_ACTIONS.openRun: {
						// A citation row is a **step** — two steps of one run cite the
						// rule twice — so it carries the step's id, and the run comes
						// from the document the page drew.
						const cited = citations.data?.items.find(
							(c) => c.step_id === ctx?.itemId,
						);
						if (cited?.run_id) onOpenRun?.(cited.run_id);
						return;
					}
					default:
						return;
				}
			}}
		/>
	);
}
