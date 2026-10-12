/**
 * The Rules section — a Graph's invariants as one section of a stack.
 *
 * The Modeller's Rules panel is this section alone; the Skills stack still
 * carries it under Skills, because both answer what a run is *given*. The
 * section owns its own drill-in and composing state, so a host only says where
 * a rule's page opens.
 *
 * **The drill-in is the header**: the trail as text, and the act on the right —
 * `Back`, and `Open this rule as a page` when the host can open one.
 */

import { Badge, type PanelStackSection } from "@invana/ui";
import { useRulesQuery } from "@invana-studio/core";
import { gateItem, useAccess } from "@invana-studio/shell";
import { SectionTitle } from "@invana-studio/ui";
import { ChevronLeft, Maximize2, Plus } from "lucide-react";
import { useState } from "react";
import { RulesSection } from "./RulesSection";

export function useRulesSection({
	username,
	graphSlug,
	onOpenRuleBoard,
}: {
	username: string;
	graphSlug: string;
	/** `Open this rule as a page` — the rule's board beside the section. */
	onOpenRuleBoard?: (ruleId: string) => void;
}): PanelStackSection {
	const [openRuleId, setOpenRuleId] = useState<string | null>(null);
	const [composing, setComposing] = useState(false);
	const rules = useRulesQuery(username, graphSlug);
	const modelGate = useAccess().gate("model");
	const openRule =
		(rules.data?.items ?? []).find((r) => r.id === openRuleId) ?? null;

	return {
		id: "rules",
		title: openRule ? (
			<span className="flex min-w-0 items-center gap-1">
				<span className="text-muted-foreground uppercase">Rules</span>
				<span className="text-muted-foreground opacity-60">/</span>
				<Badge variant="secondary" className="shrink-0">
					{openRule.kind} · v{openRule.version}
				</Badge>
			</span>
		) : (
			<SectionTitle count={(rules.data?.items ?? []).length}>
				Rules
			</SectionTitle>
		),
		headerActions: openRule
			? [
					{
						key: "back",
						name: "Back to rules",
						icon: ChevronLeft,
						onClick: () => setOpenRuleId(null),
					},
					...(onOpenRuleBoard
						? [
								{
									key: "more",
									name: "Open this rule as a page",
									icon: Maximize2,
									onClick: () => onOpenRuleBoard(openRule.id),
								},
							]
						: []),
				]
			: composing
				? []
				: [
						gateItem(
							{
								name: "New invariant",
								icon: Plus,
								onClick: () => setComposing(true),
							},
							modelGate,
						),
					],
		actionsOnHover: false,
		content: (
			<RulesSection
				username={username}
				graphSlug={graphSlug}
				openRuleId={openRuleId}
				onOpenRule={setOpenRuleId}
				composing={composing}
				onComposing={setComposing}
			/>
		),
	};
}
