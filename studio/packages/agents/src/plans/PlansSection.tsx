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
import type { ListUrl } from "@invana-studio/core";
import { type StackSectionUi, stackSection } from "@invana-studio/ui";
import {
	ArrowUpFromLine,
	Download,
	Workflow as WorkflowIcon,
} from "lucide-react";
import { filterValue, matchCount, setOne } from "../lists";
import {
	PLAN_KINDS,
	PLAN_SOURCES,
	PlansSectionBody,
	usePlanList,
} from "./PlansSectionBody";

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
	/** The URL's search and filters — the funnel writes them, the rows are the engine's answer. */
	list: ListUrl;
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
	list,
	defaultSize,
	defaultCollapsed,
}: PlansSectionProps): PanelStackSection {
	const kindFilter = filterValue(list, "family");
	const sourceFilter = filterValue(list, "origin");
	const onKindFilter = (v: string) => setOne(list, "family", v);
	const onSourceFilter = (v: string) => setOne(list, "origin", v);
	return stackSection(
		{
			id: "plans",
			label: "Plans",
			icon: WorkflowIcon,
			count: (
				<PlansCount username={username} graphSlug={graphSlug} list={list} />
			),
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
			children: () => (
				<PlansSectionBody
					username={username}
					graphSlug={graphSlug}
					list={list}
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
 * `6 · 3 packaged` — what the section header carries beside its label. The
 * total is *how much there is to pick from*; the packaged share is *how much
 * of it came with Invana or a plugin*, which is the one split a reader asks
 * about first. While a search or a filter is applied it reads `2 of 6 match`.
 */
function PlansCount({
	username,
	graphSlug,
	list,
}: {
	username: string;
	graphSlug: string;
	list: ListUrl;
}) {
	const page = usePlanList(username, graphSlug, list).data;
	if (!page?.unfiltered_total) return null;
	if (page.applied.length) return <>{matchCount(page)}</>;
	return (
		<>
			{page.packaged ? `${page.total} · ${page.packaged} packaged` : page.total}
		</>
	);
}
