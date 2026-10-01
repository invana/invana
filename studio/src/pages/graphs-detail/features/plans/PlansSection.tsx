// **Plans** — the first section of the Library stack (graph-detail-page.md §3a).
//
// A plan is what can be run, and the two sections under it are what it is made
// of: the catalogue it may name, and the template that renders what it produced.
// The journal of what actually ran is **Runs**, its own panel.
//
// The library lists **reusable plans only**, with origin as a badge
// (the-library.md) — a workflow is a reusable TaskPlan, not a kind,
// so there is no Workflows icon any more.

import {
	DropdownMenuLabel,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuSeparator,
	type PanelStackSection,
} from "@invana/ui";
import {
	ArrowUpFromLine,
	Download,
	Workflow as WorkflowIcon,
} from "lucide-react";
import {
	PLAN_KINDS,
	PLAN_SOURCES,
	PlansSectionBody,
} from "@/pages/graphs-detail/features/plans/PlansSectionBody";
import { useTaskPlansQuery } from "@/pages/graphs-detail/features/plans/queries";
import {
	type StackSectionUi,
	stackSection,
} from "@/pages/graphs-detail/shared/StackSection";

export interface PlansSectionProps {
	username: string;
	graphSlug: string;
	ui: StackSectionUi;
	/** `&plan=` — the plan whose detail replaces this section's body. */
	planKey: string | null;
	onOpenPlan: (key: string | null) => void;
	selectedStepId: string | null;
	onOpenAgent?: (agentId: string) => void;
	/** Promoting is the list's one write — its control is this section's header. */
	promoting: boolean;
	onPromoting: (v: boolean) => void;
	exportUrl?: (key: string) => string;
	kindFilter: string;
	onKindFilter: (v: string) => void;
	sourceFilter: string;
	onSourceFilter: (v: string) => void;
	defaultSize?: number | string;
	defaultCollapsed?: boolean;
}

export function plansSection({
	username,
	graphSlug,
	ui,
	planKey,
	onOpenPlan,
	selectedStepId,
	onOpenAgent,
	promoting,
	onPromoting,
	exportUrl,
	kindFilter,
	onKindFilter,
	sourceFilter,
	onSourceFilter,
	defaultSize,
	defaultCollapsed,
}: PlansSectionProps): PanelStackSection {
	return stackSection(
		{
			id: "plans",
			label: "Plans",
			icon: WorkflowIcon,
			count: <PlansCount username={username} graphSlug={graphSlug} />,
			trail: planKey ?? undefined,
			onBack: () => onOpenPlan(null),
			// The list's one write, in the slot every section puts its own act in —
			// and gone while drilled in, because it acts on the list.
			headerActions: [
				{
					key: "promote",
					name: "Promote a plan…",
					icon: ArrowUpFromLine,
					onClick: () => onPromoting(true),
				},
			],
			// An act on the record on screen, beside `‹ Back`.
			detailActions:
				planKey && exportUrl
					? [
							{
								key: "export",
								name: "Export YAML",
								icon: Download,
								onClick: () =>
									window.open(exportUrl(planKey), "_blank", "noopener"),
							},
						]
					: undefined,
			searchable: true,
			searchPlaceholder: "Search plans",
			filtered: Boolean(kindFilter || sourceFilter),
			filterMenu: (
				<>
					<DropdownMenuLabel>Kind</DropdownMenuLabel>
					<DropdownMenuRadioGroup
						value={kindFilter || "all"}
						onValueChange={(v) => onKindFilter(v === "all" ? "" : v)}
					>
						<DropdownMenuRadioItem value="all">all kinds</DropdownMenuRadioItem>
						{PLAN_KINDS.map((k) => (
							<DropdownMenuRadioItem key={k} value={k}>
								{k}
							</DropdownMenuRadioItem>
						))}
					</DropdownMenuRadioGroup>
					<DropdownMenuSeparator />
					<DropdownMenuLabel>Origin</DropdownMenuLabel>
					<DropdownMenuRadioGroup
						value={sourceFilter || "all"}
						onValueChange={(v) => onSourceFilter(v === "all" ? "" : v)}
					>
						<DropdownMenuRadioItem value="all">
							every origin
						</DropdownMenuRadioItem>
						{PLAN_SOURCES.map((s) => (
							<DropdownMenuRadioItem key={s} value={s}>
								{s}
							</DropdownMenuRadioItem>
						))}
					</DropdownMenuRadioGroup>
				</>
			),
			defaultSize,
			defaultCollapsed,
			children: ({ search }) => (
				<PlansSectionBody
					username={username}
					graphSlug={graphSlug}
					search={search}
					kindFilter={kindFilter}
					sourceFilter={sourceFilter}
					selectedKey={planKey}
					onSelectKey={onOpenPlan}
					selectedStepId={selectedStepId}
					onOpenAgent={onOpenAgent}
					promoting={promoting}
					onPromoting={onPromoting}
				/>
			),
		},
		ui,
	);
}

/**
 * `6 · 3 builtin` — what the section header carries beside its label, as the
 * artboard draws it. The total is *how much there is to pick from*; the builtin
 * share is *how much of it came with Invana*, which is the one split a reader
 * asks about before they have authored anything.
 */
function PlansCount({
	username,
	graphSlug,
}: {
	username: string;
	graphSlug: string;
}) {
	const list = useTaskPlansQuery(username, graphSlug);
	const items = list.data?.items ?? [];
	if (!items.length) return null;
	const builtin = items.filter((w) => w.origin === "builtin").length;
	return <>{builtin ? `${items.length} · ${builtin} builtin` : items.length}</>;
}
