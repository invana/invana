/**
 * Skills — a **stack**, not a list (G33): `Skills` over `Rules`.
 *
 * The two drawers answer different questions about one subject — what a run is
 * *given* before it runs. A skill is a playbook that may be offered; a rule is
 * a statement that is always true. Both reach a step as discrete items with
 * ids, and **neither is enforced** (skills/spec.md § 2).
 *
 * A stack has no panel header above its drawers: the first drawer header is the
 * top of the column, and the breadcrumb already says which panel is open (G32).
 * A drill-in replaces that drawer's body and turns its header into
 * `‹ SKILLS / Escalate a late supplier`; the Rules drawer keeps its place
 * underneath (SK17).
 *
 * ## The canvas keeps whatever it was showing
 *
 * A skill is a setting that hangs over the work, not a thing with a shape — so
 * this panel opens beside the canvas already on screen rather than replacing
 * it. That is why it takes no canvas of its own.
 */

import {
	useCreateSkillMutation,
	useRulesQuery,
	useSkillsQuery,
} from "@/hooks/queries/useSkills";
import { RulesDrawer } from "@/pages/graphs-detail/features/skills/RulesDrawer";
import { SkillDetail } from "@/pages/graphs-detail/features/skills/SkillDetail";
import { SectionTitle } from "@/pages/graphs-detail/shared/SectionTitle";
import type { Skill } from "@/types/skills";
import { PanelStatusBar, StatusCrumb } from "@/ui/PanelStatusBar";
import { Badge, PanelStack, type PanelStackSection, Spinner } from "@invana/ui";
import { ChevronLeft, Maximize2, Plus } from "lucide-react";
import { useState } from "react";

interface Props {
	username: string;
	graphSlug: string;
	onClose?: () => void;
	selectedSkillId: string | null;
	onSelectSkill: (id: string | null) => void;
	onOpenAgent?: (agentId: string) => void;
	/**
	 * `More` — open the drilled-in record as a declared board.
	 *
	 * Only ever offered **drilled in**: `More` on a list is a question about
	 * which row, and the row is the thing being read (SK36 · RU11). The stack
	 * stays where it is; the board opens beside it.
	 */
	onOpenSkillDashboard?: (skillId: string) => void;
	/**
	 * `More` on the **Usage** tab — the usage board, which is a different
	 * reading of the same skill and so a different page (SD2). It lives in the
	 * tab rather than in the panel header, because a header action that changed
	 * meaning with the selected tab would be two actions wearing one icon.
	 */
	onOpenUsageDashboard?: (skillId: string) => void;
	onOpenRuleDashboard?: (ruleId: string) => void;
}

export function SkillsPanel({
	username,
	graphSlug,
	selectedSkillId,
	onSelectSkill,
	onOpenAgent,
	onOpenSkillDashboard,
	onOpenUsageDashboard,
	onOpenRuleDashboard,
}: Props) {
	const [editing, setEditing] = useState(false);
	const [openRuleId, setOpenRuleId] = useState<string | null>(null);
	const [composingRule, setComposingRule] = useState(false);
	const rules = useRulesQuery(username, graphSlug);
	const openRule =
		(rules.data?.items ?? []).find((r) => r.id === openRuleId) ?? null;

	const skills = useSkillsQuery(username, graphSlug);
	const create = useCreateSkillMutation(username, graphSlug);
	const items = skills.data?.items ?? [];
	const selected = items.find((s) => s.id === selectedSkillId) ?? null;

	/**
	 * A new skill is a **draft** the moment it is created: the row exists, its
	 * plan exists as one `form: human` node, and the drawer opens on it with the
	 * prose empty (SK20 · SK22). Nothing is offered it until it is published.
	 */
	const newSkill = () => {
		create.mutate(
			{ name: `Untitled skill ${items.length + 1}` },
			{
				onSuccess: (skill) => {
					onSelectSkill(skill.id);
					setEditing(true);
				},
			},
		);
	};

	const skillsBody = () => {
		if (selected)
			return (
				<SkillDetail
					username={username}
					graphSlug={graphSlug}
					skill={selected}
					editing={editing || selected.is_draft}
					onEditing={setEditing}
					onOpenAgent={onOpenAgent}
					onOpenUsageDashboard={onOpenUsageDashboard}
				/>
			);

		if (skills.isLoading)
			return (
				<div className="p-4">
					<Spinner />
				</div>
			);
		if (items.length === 0)
			return (
				<p className="px-3 py-2 text-base text-muted-foreground">
					No skills yet. A skill is a playbook an agent may be offered — how to
					approach something, written once.
				</p>
			);
		return (
			<div className="pb-2.5">
				{items.map((skill) => (
					<SkillRow
						key={skill.id}
						skill={skill}
						onClick={() => {
							setEditing(false);
							onSelectSkill(skill.id);
						}}
					/>
				))}
			</div>
		);
	};

	/**
	 * The drill-in **is** the drawer's header — `‹ SKILLS / <name>` as the
	 * section's own title, never a second bar inside the body (G33 · SK17).
	 */
	const skillsTitle = selected ? (
		<span className="flex min-w-0 items-center gap-1">
			<span className="text-muted-foreground uppercase">Skills</span>
			<span className="text-muted-foreground opacity-60">/</span>
			<span className="truncate font-medium">{selected.name}</span>
			<Badge variant="secondary" className="shrink-0">
				{selected.is_draft ? "draft" : `v${selected.version}`}
			</Badge>
		</span>
	) : (
		<SectionTitle count={items.length}>Skills</SectionTitle>
	);

	const sections: PanelStackSection[] = [
		{
			id: "skills",
			title: skillsTitle,
			// The header has one action area, and it carries the act the drawer
			// is for: creating, in the list; going back, once drilled in. The
			// trail itself is text — a PanelStack header **is** the collapse
			// control, so an interactive crumb inside it would be a button in a
			// button, which is invalid and steals the collapse click. `TaskDrawer`
			// drills in the same way.
			headerActions: selected
				? [
						{
							key: "back",
							name: "Back to skills",
							icon: ChevronLeft,
							onClick: () => {
								setEditing(false);
								onSelectSkill(null);
							},
						},
						// The whole skill as a page — the drawer keeps its place,
						// which is the point of opening one deliberately rather
						// than growing this column (SK36 · CV14).
						...(onOpenSkillDashboard
							? [
									{
										key: "more",
										name: "Open this skill as a page",
										icon: Maximize2,
										onClick: () => onOpenSkillDashboard(selected.id),
									},
								]
							: []),
					]
				: [
						{
							name: "New skill",
							icon: Plus,
							onClick: newSkill,
						},
					],
			actionsOnHover: false,
			content: skillsBody(),
		},
		{
			id: "rules",
			// The same rule the Skills drawer follows: the drill-in **is** the
			// header — the trail as text, and the act on the right.
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
						...(onOpenRuleDashboard
							? [
									{
										key: "more",
										name: "Open this rule as a page",
										icon: Maximize2,
										onClick: () => onOpenRuleDashboard(openRule.id),
									},
								]
							: []),
					]
				: composingRule
					? []
					: [
							{
								name: "New invariant",
								icon: Plus,
								onClick: () => setComposingRule(true),
							},
						],
			actionsOnHover: false,
			content: (
				<RulesDrawer
					username={username}
					graphSlug={graphSlug}
					openRuleId={openRuleId}
					onOpenRule={setOpenRuleId}
					composing={composingRule}
					onComposing={setComposingRule}
				/>
			),
		},
	];

	return (
		<div className="flex h-full min-h-0 flex-col">
			<div className="min-h-0 flex-1">
				<PanelStack sections={sections} withHandle />
			</div>
			<PanelStatusBar
				left={<StatusCrumb active>Skills</StatusCrumb>}
				right="offered, never obeyed — the canvas stays as it was"
			/>
		</div>
	);
}

/**
 * The drawn row: the name, its version, the whole `when_to_use` sentence, and
 * how many agents carry it. The sentence is not truncated to a word — it is the
 * thing a reader is deciding about.
 */
function SkillRow({ skill, onClick }: { skill: Skill; onClick: () => void }) {
	return (
		<button
			type="button"
			onClick={onClick}
			className="block w-full border-b px-3 py-2 text-left last:border-b-0 hover:bg-muted/50"
		>
			<div className="flex items-center gap-1.5">
				<span className="truncate text-base font-medium">{skill.name}</span>
				{skill.is_draft ? (
					// A draft says so: nothing is offered it, and a row that looked
					// published would be the one lie this list can tell (SK21).
					<Badge variant="outline" className="shrink-0">
						draft
					</Badge>
				) : (
					<Badge variant="secondary" className="shrink-0">
						v{skill.version}
					</Badge>
				)}
				{skill.origin === "builtin" ? (
					<Badge variant="outline" className="shrink-0">
						builtin
					</Badge>
				) : null}
			</div>
			<p className="mt-0.5 text-base text-muted-foreground">
				{skill.when_to_use || "no when-to-use — it is offered on every ask"}
			</p>
			{skill.plan ? (
				<p className="mt-0.5 truncate text-base text-muted-foreground">
					{skill.plan.step_count} step
					{skill.plan.step_count === 1 ? "" : "s"} ·{" "}
					{skill.plan.layers.join(" · ")}
				</p>
			) : null}
		</button>
	);
}
