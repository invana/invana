/**
 * **Skills** — every skill in the Graph as one table, at `/agents/skills`
 * (the-agents-shell.md › Skills).
 *
 * *As a builder, I want every skill on one page — which are published, which
 * are still drafts, and what each one's plan reaches — so that I can find the
 * one to work on.*
 *
 * A skill is a playbook an agent may be offered, never enforced: instructions
 * in Markdown, the plan generated from them, and its evals. The list is on the
 * list contract (list-contract.md): `All · Published · Drafts` and the search
 * box write the URL (`?f.status=` · `?q=`), the engine filters, and the
 * applied-filters strip names what is applied with *N of M match*.
 *
 * *Runs 30d* is Performance's 30-day skill row, joined by id — the engine's
 * count, never one made here.
 *
 * *New skill* creates an `untitled` draft holding the four headings and opens
 * its page on Instructions — nothing is offered it until it is published. A
 * row opens the skill's page as a workbook tab.
 */

import { type ColumnDef, DataTable } from "@invana/tables";
import {
	Badge,
	EmptyState,
	SearchInput,
	SegmentedControl,
	Spinner,
} from "@invana/ui";
import { formatRelativeTime, useListParams } from "@invana-studio/core";
import { ActButton } from "@invana-studio/shell";
import { Plus } from "lucide-react";
import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { useFleetPerformanceQuery } from "../fleet/queries";
import type { PerformanceRow } from "../fleet/types";
import {
	chipsOf,
	EVERY,
	FilteredEmpty,
	filterValue,
	ListStrip,
	matchCount,
	PAGE,
	setOne,
} from "../lists";
import { useAgentsOpen } from "../open";
import { FleetReadState } from "../overview/fleetParts";
import { SectionBody, SectionPage } from "../sections/SectionPage";
import type { SectionPageProps } from "../sections/spec";
import { newSkillContent } from "./instructionsText";
import { useCreateSkillMutation, useSkillsQuery } from "./queries";
import type { Skill } from "./types";

/** The segments, by the list's `status` filter; `all` sends none. */
const SHOWING = [
	{ value: "all", label: "All" },
	{ value: "published", label: "Published" },
	{ value: "draft", label: "Drafts" },
];

export function SkillsListPage({ username, graphSlug }: SectionPageProps) {
	const open = useAgentsOpen();
	const list = useListParams();
	const [search] = useSearchParams();
	const query = useSkillsQuery(username, graphSlug, {
		...list.query,
		limit: PAGE,
	});
	const create = useCreateSkillMutation(username, graphSlug);
	const perf = useFleetPerformanceQuery(username, graphSlug, "30d");
	const columns = useMemo(
		() =>
			skillColumns(new Map((perf.data?.skills ?? []).map((r) => [r.id, r]))),
		[perf.data],
	);

	const page = query.data;
	const rows = page?.items ?? [];
	const chips = chipsOf(page, list);
	const status = filterValue(list, "status");

	// Names are unique in a Graph, so a second untitled draft is `untitled-2`.
	const every = useSkillsQuery(username, graphSlug, EVERY);
	const newSkill = () => {
		const taken = new Set((every.data?.items ?? []).map((s) => s.name));
		let name = "untitled";
		for (let n = 2; taken.has(name); n++) name = `untitled-${n}`;
		create.mutate(
			{ name, content: newSkillContent(name) },
			{ onSuccess: (skill) => open.skill(skill.id) },
		);
	};

	return (
		<SectionPage
			section="skills"
			chips={
				page ? (
					<Badge variant="outline" tone="muted" size="xs">
						{matchCount(page, "skills")}
					</Badge>
				) : null
			}
			actions={
				<ActButton
					area="build"
					size="sm"
					onClick={newSkill}
					disabled={create.isPending}
				>
					<Plus />
					New skill
				</ActButton>
			}
		>
			<SectionBody>
				<div className="flex flex-wrap items-center gap-2">
					<SegmentedControl
						size="sm"
						aria-label="Showing"
						value={status || "all"}
						onValueChange={(v) => setOne(list, "status", v === "all" ? "" : v)}
						options={SHOWING}
					/>
					<SearchInput
						inputSize="sm"
						className="w-64"
						placeholder="Find a skill"
						value={search.get("q") ?? ""}
						onChange={list.setQ}
					/>
				</div>
				<ListStrip page={page} list={list} />
				{query.isLoading ? (
					<Spinner />
				) : query.error ? (
					<FleetReadState
						loading={false}
						error={query.error}
						what="the skills"
					/>
				) : rows.length === 0 ? (
					chips.length ? (
						<FilteredEmpty noun="skill" filters={chips} onClear={list.clear} />
					) : (
						<EmptyState
							title="No skills yet"
							description="A skill is a playbook an agent may be offered — how to approach something, written once."
						/>
					)
				) : (
					<DataTable
						columns={columns}
						data={rows}
						enableSorting={false}
						getRowId={(row) => row.id}
						onRowClick={(row) => open.skill(row.id)}
					/>
				)}
			</SectionBody>
		</SectionPage>
	);
}

function skillColumns(perf: Map<string, PerformanceRow>): ColumnDef<Skill>[] {
	return [
		{
			id: "skill",
			header: "Skill",
			cell: ({ row }) => (
				<span className="font-medium">{row.original.name}</span>
			),
		},
		{
			id: "version",
			header: "Version",
			cell: ({ row }) => (
				<span className="font-mono">
					{row.original.is_draft ? "—" : `v${row.original.version}`}
				</span>
			),
		},
		{
			id: "state",
			header: "State",
			cell: ({ row }) => <StateBadge skill={row.original} />,
		},
		{
			id: "plan",
			header: "Plan",
			cell: ({ row }) => {
				const plan = row.original.plan;
				if (!plan) return <span className="text-muted-foreground">—</span>;
				return (
					<span className="text-muted-foreground">
						{plan.step_count} step{plan.step_count === 1 ? "" : "s"}
						{plan.layers.length ? ` · ${plan.layers.join(" · ")}` : ""}
					</span>
				);
			},
		},
		{
			id: "runs",
			header: "Runs 30d",
			cell: ({ row }) => (
				<span className="font-mono">
					{perf.get(row.original.id)?.runs.toLocaleString() ?? "—"}
				</span>
			),
		},
		{
			id: "changed",
			header: "Changed",
			cell: ({ row }) => (
				<span className="text-muted-foreground">
					{formatRelativeTime(new Date(row.original.updated_at))}
				</span>
			),
		},
	];
}

/** `published` · `draft` — and a published skill with a draft open says so. */
function StateBadge({ skill }: { skill: Skill }) {
	if (skill.is_draft)
		return (
			<Badge variant="outline" tone="muted" size="xs">
				draft
			</Badge>
		);
	return (
		<span className="inline-flex items-center gap-1">
			<Badge variant="outline" tone="success" size="xs">
				published
			</Badge>
			{skill.draft_version_id ? (
				<Badge variant="outline" tone="muted" size="xs">
					draft open
				</Badge>
			) : null}
		</span>
	);
}
