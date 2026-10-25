/**
 * The Policies section — every policy of this Graph by kind, who holds it and
 * what it allows (policies.md › `iam.policies`).
 *
 * *As an iam-admin, I want every policy on one page with who holds it, so that
 * access is read in one place.*
 *
 * The list is on the list contract: the kind tabs `All · Managed · Custom ·
 * Inline · Boundary` write `?f.kind=`, *Find a policy* writes `?q=`, and the
 * engine filters and counts — the tab counts are its `kinds`, `All` its
 * unfiltered total. A row opens the policy's page as a tab of its own.
 *
 * *New policy* and *Draft with the assistant* are modals (`?dialog=new` ·
 * `?dialog=draft`). Without iam-admin both are drawn disabled with the reason,
 * and `?dialog=new` draws the read-only lock in place of the form.
 */

import { type ColumnDef, DataTable } from "@invana/tables";
import {
	AppliedFilters,
	Badge,
	Button,
	EmptyState,
	SearchInput,
	SegmentedControl,
} from "@invana/ui";
import { useListParams, whoToAsk } from "@invana-studio/core";
import { ActButton, useAccess } from "@invana-studio/shell";
import { SectionBody } from "@invana-studio/ui";
import { Lock, Plus, ScrollText, Sparkles } from "lucide-react";
import { useMemo } from "react";
import { useLocation, useSearchParams } from "react-router-dom";
import { useIamOpen } from "../open";
import { usePoliciesQuery } from "../queries";
import { SectionPage } from "../sections/SectionPage";
import type { SectionPageProps } from "../sections/spec";
import type { PolicyKindName, PolicyRow } from "../types";
import { DraftPolicyDialog } from "./DraftPolicyDialog";
import { NewPolicyDialog } from "./NewPolicyDialog";
import {
	byLine,
	DraftBadge,
	KindBadge,
	ReadState,
	usePageParam,
} from "./policyParts";

const KINDS: { value: PolicyKindName; label: string }[] = [
	{ value: "managed", label: "Managed" },
	{ value: "custom", label: "Custom" },
	{ value: "inline", label: "Inline" },
	{ value: "boundary", label: "Boundary" },
];

const DIALOGS = ["new", "draft"] as const;

const PAGE = 200;

export function PoliciesPage({ username, graphSlug }: SectionPageProps) {
	const open = useIamOpen();
	const list = useListParams();
	const [search] = useSearchParams();
	const { pathname } = useLocation();
	// In front when the path is this section's and no record tab is open.
	const inFront = !search.get("page") && pathname.endsWith("/iam/policies");
	const [dialog, setDialog] = usePageParam("dialog", inFront, DIALOGS, null);
	const gate = useAccess().gate("iam");
	const query = usePoliciesQuery(username, graphSlug, {
		...list.query,
		limit: PAGE,
	});
	const columns = useMemo(policyColumns, []);
	const page = query.data;
	const kind = list.query.filters?.kind?.[0] ?? "";
	const chips = page?.applied ?? list.pending;

	const opened = (name: string) => {
		setDialog(null);
		open.policy(name);
	};

	const denied = dialog === "new" && !gate.allowed;

	return (
		<SectionPage
			section="policies"
			chips={
				page ? (
					<Badge variant="outline" tone="muted">
						{page.applied.length
							? `${page.total} of ${page.unfiltered_total} match`
							: `${page.total} policies`}
					</Badge>
				) : null
			}
			actions={
				<>
					<ActButton
						area="iam"
						size="sm"
						variant="outline"
						onClick={() => setDialog("draft")}
					>
						<Sparkles />
						Draft with the assistant
					</ActButton>
					<ActButton area="iam" size="sm" onClick={() => setDialog("new")}>
						<Plus />
						New policy
					</ActButton>
				</>
			}
		>
			{denied ? (
				<EmptyState
					className="h-full"
					icon={<Lock className="size-6" />}
					title="You can read policies, not change them"
					description={`Changing policies and tokens needs ${gate.role ?? "iam-admin"}. Ask ${whoToAsk(gate.holders)}.`}
					actions={
						<Button variant="ghost" size="sm" onClick={() => setDialog(null)}>
							Open policies read-only
						</Button>
					}
				/>
			) : (
				<SectionBody>
					<div className="flex flex-wrap items-center gap-2">
						<SegmentedControl
							size="sm"
							aria-label="Kind"
							value={kind || "all"}
							onValueChange={(v) =>
								list.setFilter("kind", v === "all" ? [] : [v])
							}
							options={[
								{
									value: "all",
									label: page ? `All ${page.unfiltered_total}` : "All",
								},
								...KINDS.map((k) => ({
									value: k.value,
									label: page
										? `${k.label} ${page.kinds[k.value] ?? 0}`
										: k.label,
								})),
							]}
						/>
						<SearchInput
							inputSize="sm"
							className="ml-auto w-64"
							placeholder="Find a policy"
							value={search.get("q") ?? ""}
							onChange={list.setQ}
						/>
					</div>
					<AppliedFilters
						className="shrink-0"
						filters={chips}
						onRemove={list.remove}
						onClearAll={list.clear}
						setBy={list.viaAssistant ? "the assistant" : undefined}
					/>
					{query.isLoading || query.error ? (
						<ReadState
							loading={query.isLoading}
							error={query.error}
							what="the policies"
							onRetry={() => void query.refetch()}
						/>
					) : !page?.items.length ? (
						<EmptyState
							title={
								chips.length
									? "No policy matches these filters"
									: "No policies yet"
							}
							description={
								chips.length
									? "Remove a filter above, or clear them all."
									: "Every Graph is given its managed policies — try refreshing."
							}
							actions={
								chips.length ? (
									<Button size="sm" variant="outline" onClick={list.clear}>
										Clear all
									</Button>
								) : undefined
							}
						/>
					) : (
						<DataTable
							columns={columns}
							data={page.items}
							enableSorting={false}
							getRowId={(row) => row.id}
							onRowClick={(row) => open.policy(row.name)}
						/>
					)}
				</SectionBody>
			)}
			{dialog === "new" && gate.allowed ? (
				<NewPolicyDialog
					username={username}
					graphSlug={graphSlug}
					onClose={() => setDialog(null)}
					onCreated={opened}
				/>
			) : null}
			{dialog === "draft" && gate.allowed ? (
				<DraftPolicyDialog
					username={username}
					graphSlug={graphSlug}
					onClose={() => setDialog(null)}
					onDrafted={opened}
				/>
			) : null}
		</SectionPage>
	);
}

function policyColumns(): ColumnDef<PolicyRow>[] {
	return [
		{
			id: "policy",
			header: "Policy",
			cell: ({ row }) => (
				<span className="inline-flex items-center gap-1.5 font-medium">
					<ScrollText className="size-3.5 text-primary" />
					{row.original.name}
				</span>
			),
		},
		{
			id: "kind",
			header: "Kind",
			cell: ({ row }) => (
				<span className="inline-flex items-center gap-1">
					<KindBadge kind={row.original.kind} />
					{row.original.status === "draft" ? <DraftBadge /> : null}
				</span>
			),
		},
		{
			id: "summary",
			header: "What it allows",
			cell: ({ row }) => row.original.summary || "—",
		},
		{
			id: "statements",
			header: "Statements",
			cell: ({ row }) => (
				<span className="font-mono">{row.original.statement_count}</span>
			),
		},
		{
			id: "held_by",
			header: "Held by",
			cell: ({ row }) => row.original.held_by.line,
		},
		{
			id: "changed",
			header: "Changed",
			cell: ({ row }) => (
				<span className="text-muted-foreground">
					{byLine(row.original.changed_by, row.original.changed_at)}
				</span>
			),
		},
	];
}
