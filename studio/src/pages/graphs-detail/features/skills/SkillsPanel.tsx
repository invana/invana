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
 * The Skills drawer is its list: selecting a row gives a quick look under it,
 * and **Open** gives the skill's page in `mainSection` (SK17 · SK37). The Rules
 * drawer keeps its place underneath.
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
	useSkillAgentsQuery,
	useSkillUsageQuery,
	useSkillsQuery,
} from "@/hooks/queries/useSkills";
import { RulesDrawer } from "@/pages/graphs-detail/features/skills/RulesDrawer";
import { DetailStatus } from "@/pages/graphs-detail/shared/DetailRows";
import { SectionTitle } from "@/pages/graphs-detail/shared/SectionTitle";
import type { Skill } from "@/types/skills";
import { PanelStatusBar, StatusCrumb } from "@/ui/PanelStatusBar";
import {
	Badge,
	Button,
	CardFooter,
	PanelStack,
	type PanelStackSection,
	PropertyList,
	PropertyRow,
	Spinner,
} from "@invana/ui";
import { ChevronLeft, ChevronRight, Maximize2, Plus } from "lucide-react";
import { useState } from "react";

interface Props {
	username: string;
	graphSlug: string;
	onClose?: () => void;
	selectedSkillId: string | null;
	onSelectSkill: (id: string | null) => void;
	/**
	 * **Open** — the skill's page in `mainSection` (SK17 · SK37). The stack
	 * stays where it is; the page opens beside it.
	 */
	onOpenSkillPage: (skillId: string) => void;
	onOpenRuleDashboard?: (ruleId: string) => void;
}

export function SkillsPanel({
	username,
	graphSlug,
	selectedSkillId,
	onSelectSkill,
	onOpenSkillPage,
	onOpenRuleDashboard,
}: Props) {
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
	 * plan exists as one `form: human` node, and its page opens on Playbook with
	 * the prose empty (SK20 · SK22 · SK37). Nothing is offered it until it is
	 * published.
	 */
	const newSkill = () => {
		create.mutate(
			{ name: `Untitled skill ${items.length + 1}` },
			{
				onSuccess: (skill) => {
					onSelectSkill(skill.id);
					onOpenSkillPage(skill.id);
				},
			},
		);
	};

	const skillsBody = () => {
		if (skills.isLoading)
			return (
				<div className="px-3 py-4">
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
			<div className="flex h-full min-h-0 flex-col">
				<div className="min-h-0 flex-1 overflow-y-auto">
					{items.map((skill) => (
						<SkillRow
							key={skill.id}
							skill={skill}
							active={skill.id === selected?.id}
							onClick={() =>
								onSelectSkill(skill.id === selected?.id ? null : skill.id)
							}
						/>
					))}
				</div>
				{selected ? (
					<>
						<SkillQuickLook
							username={username}
							graphSlug={graphSlug}
							skill={selected}
						/>
						<CardFooter className="shrink-0 gap-2 border-t">
							<Button
								size="sm"
								variant="outline"
								onClick={() => onOpenSkillPage(selected.id)}
							>
								<ChevronRight /> Open
							</Button>
						</CardFooter>
					</>
				) : null}
			</div>
		);
	};

	const sections: PanelStackSection[] = [
		{
			id: "skills",
			title: <SectionTitle count={items.length}>Skills</SectionTitle>,
			// The header's one action area carries the act the drawer is for
			// (SK27). The drawer does not drill in — the detail is the page.
			headerActions: [
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
			// The drill-in **is** the header — the trail as text, and the act on
			// the right (SK27).
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
function SkillRow({
	skill,
	active,
	onClick,
}: {
	skill: Skill;
	active: boolean;
	onClick: () => void;
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			aria-pressed={active}
			className={`block w-full border-b px-3 py-2 text-left last:border-b-0 hover:bg-muted/50 ${
				active ? "bg-muted" : ""
			}`}
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

/**
 * The selected row's quick look (SK37): which one is this, and is it used.
 * Everything else is on the page, one click on by **Open**.
 */
function SkillQuickLook({
	username,
	graphSlug,
	skill,
}: {
	username: string;
	graphSlug: string;
	skill: Skill;
}) {
	const usage = useSkillUsageQuery(username, graphSlug, skill.id);
	const agents = useSkillAgentsQuery(username, graphSlug, skill.id);
	const current =
		usage.data?.versions.find(
			(v) => v.skill_version_id === usage.data?.current_version_id,
		) ?? null;
	const bound = (agents.data?.items ?? []).filter((a) => a.bound).length;
	return (
		<div className="shrink-0 border-t">
			<div className="flex items-center gap-2 border-b border-border/60 px-3 py-2">
				<span className="min-w-0 flex-1 truncate font-semibold">
					{skill.name}
				</span>
				<DetailStatus>
					{skill.is_draft ? "draft" : `v${skill.version}`}
				</DetailStatus>
			</div>
			<div className="px-3 py-2">
				<p className="line-clamp-2 pb-1 text-muted-foreground">
					{skill.when_to_use || "no when-to-use — it is offered on every ask"}
				</p>
				<PropertyList labelWidth={84}>
					<PropertyRow label="usage">
						{skill.is_draft
							? "nothing published yet"
							: current
								? `offered ${current.offered} · applied ${current.applied}`
								: usage.isLoading
									? "…"
									: "no data yet"}
					</PropertyRow>
					<PropertyRow label="agents">
						{agents.data ? `${bound} bound` : "…"}
					</PropertyRow>
				</PropertyList>
			</div>
		</div>
	);
}
