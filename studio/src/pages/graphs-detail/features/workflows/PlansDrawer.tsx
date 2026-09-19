// **Plans** — the first drawer of the Library stack (graph-detail-page.md §3a ·
// G41).
//
// A plan is what can be run, and the two drawers under it are what it is made
// of: the catalogue it may name, and the template that renders what it produced.
// The journal of what actually ran is **Runs**, its own panel (SR1).
//
// The library lists **reusable plans only**, with origin as a badge
// (the-library.md LB5–LB7) — a workflow is a reusable TaskPlan, not a kind
// (SR5), so there is no Workflows icon any more (G30).

import { useWorkflowsQuery } from "@/hooks/queries/useWork";
import { PlansDrawerBody } from "@/pages/graphs-detail/features/workflows/TaskPlansPanel";
import {
	PLAN_KINDS,
	PLAN_SOURCES,
} from "@/pages/graphs-detail/features/workflows/TaskPlansPanel";
import {
	type TaskDrawerUi,
	taskDrawerSection,
} from "@/pages/graphs-detail/shared/TaskDrawer";
import {
	DropdownMenuLabel,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuSeparator,
	type PanelStackSection,
} from "@invana/ui";
import { Workflow as WorkflowIcon } from "lucide-react";

export interface PlansDrawerProps {
	username: string;
	graphSlug: string;
	ui: TaskDrawerUi;
	/** `&plan=` — the plan whose detail replaces this drawer's body. */
	planKey: string | null;
	onOpenPlan: (key: string | null) => void;
	selectedStepId: string | null;
	onOpenCanvas?: (key: string) => void;
	onOpenAgent?: (agentId: string) => void;
	exportUrl?: (key: string) => string;
	kindFilter: string;
	onKindFilter: (v: string) => void;
	sourceFilter: string;
	onSourceFilter: (v: string) => void;
	defaultSize?: number | string;
	defaultCollapsed?: boolean;
}

export function plansDrawerSection({
	username,
	graphSlug,
	ui,
	planKey,
	onOpenPlan,
	selectedStepId,
	onOpenCanvas,
	onOpenAgent,
	exportUrl,
	kindFilter,
	onKindFilter,
	sourceFilter,
	onSourceFilter,
	defaultSize,
	defaultCollapsed,
}: PlansDrawerProps): PanelStackSection {
	return taskDrawerSection(
		{
			id: "plans",
			label: "Plans",
			icon: WorkflowIcon,
			count: <PlansCount username={username} graphSlug={graphSlug} />,
			trail: planKey ?? undefined,
			onBack: () => onOpenPlan(null),
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
				<PlansDrawerBody
					username={username}
					graphSlug={graphSlug}
					search={search}
					kindFilter={kindFilter}
					sourceFilter={sourceFilter}
					onSourceFilter={onSourceFilter}
					selectedKey={planKey}
					onSelectKey={onOpenPlan}
					selectedStepId={selectedStepId}
					onOpenCanvas={onOpenCanvas}
					onOpenAgent={onOpenAgent}
					exportUrl={exportUrl}
				/>
			),
		},
		ui,
	);
}

/**
 * `6 · 3 builtin` — what the drawer header carries beside its label, as the
 * artboard draws it. The total is *how much there is to pick from*; the builtin
 * share is *how much of it came with Invana*, which is the one split a reader
 * asks about before they have authored anything (LB5).
 */
function PlansCount({
	username,
	graphSlug,
}: {
	username: string;
	graphSlug: string;
}) {
	const list = useWorkflowsQuery(username, graphSlug);
	const items = list.data?.items ?? [];
	if (!items.length) return null;
	const builtin = items.filter((w) => w.origin === "builtin").length;
	return <>{builtin ? `${items.length} · ${builtin} builtin` : items.length}</>;
}
