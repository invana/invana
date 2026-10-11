// **Catalogue** — the second section of the Library stack (the-catalogue.md 7.6).
//
// The closed vocabulary a plan may name at all: one entry per callable, grouped
// by the bound it spends (graph-detail-page.md §3a). It is the definition of the
// section above it, the way a template is the rendering of what that plan
// produced — which is why the three are stacked rather than given three icons.
//
// The list renders `runtime/catalogue/registry.py` through `GET …/catalogue`,
// never a second copy of the declaration. Read-only: nothing here adds,
// edits or disables an entry.

import {
	BoundChip,
	EmptyState,
	Eyebrow,
	type PanelStackSection,
	PropertyList,
	PropertyRow,
	Spinner,
} from "@invana/ui";
import { BookMarked } from "lucide-react";
import { useCatalogueQuery } from "@/pages/graphs-detail/features/plans/queries";
import type { CatalogueEntry } from "@/pages/graphs-detail/features/plans/types";
import { RecordRow } from "@/pages/graphs-detail/shared/RecordRow";
import {
	type StackSectionUi,
	stackSection,
} from "@/pages/graphs-detail/shared/StackSection";

export interface CatalogueSectionProps {
	username: string;
	graphSlug: string;
	ui: StackSectionUi;
	/** `&entry=` — the entry whose detail replaces this section's body. */
	entryKey: string | null;
	onOpenEntry: (key: string | null) => void;
	defaultSize?: number | string;
	defaultCollapsed?: boolean;
}

export function catalogueSection({
	username,
	graphSlug,
	ui,
	entryKey,
	onOpenEntry,
	defaultSize,
	defaultCollapsed,
}: CatalogueSectionProps): PanelStackSection {
	return stackSection(
		{
			id: "catalogue",
			label: "Catalogue",
			icon: BookMarked,
			count: <CatalogueCount username={username} graphSlug={graphSlug} />,
			trail: entryKey ?? undefined,
			onBack: () => onOpenEntry(null),
			searchable: true,
			searchPlaceholder: "Search tasks",
			defaultSize,
			defaultCollapsed,
			children: ({ search }) => (
				<CatalogueSectionBody
					username={username}
					graphSlug={graphSlug}
					search={search}
					entryKey={entryKey}
					onOpenEntry={onOpenEntry}
				/>
			),
		},
		ui,
	);
}

function CatalogueCount({
	username,
	graphSlug,
}: {
	username: string;
	graphSlug: string;
}) {
	const total = useCatalogueQuery(username, graphSlug).data?.total;
	return total ? <>{total}</> : null;
}

function CatalogueSectionBody({
	username,
	graphSlug,
	search,
	entryKey,
	onOpenEntry,
}: {
	username: string;
	graphSlug: string;
	search: string;
	entryKey: string | null;
	onOpenEntry: (key: string | null) => void;
}) {
	const catalogue = useCatalogueQuery(username, graphSlug);
	const items = catalogue.data?.items ?? [];

	if (catalogue.isLoading)
		return (
			<div className="px-3 py-4">
				<Spinner />
			</div>
		);
	if (catalogue.isError)
		return (
			<EmptyState
				className="px-3 py-4"
				title="The catalogue did not load"
				description="The engine did not answer. Reopen the drawer to try again."
			/>
		);

	if (entryKey) {
		const entry = items.find((e) => e.step_key === entryKey);
		return entry ? (
			<EntryDetail entry={entry} onOpenEntry={onOpenEntry} />
		) : (
			<EmptyState
				className="px-3 py-4"
				title="No such task"
				description={`This engine's catalogue has no "${entryKey}". A plan naming it cannot run.`}
			/>
		);
	}

	// Search reads key, summary and bound; the groups stay the navigation.
	const q = search.toLowerCase();
	const rows = items.filter((e) =>
		[e.step_key, e.summary, e.bound].some((s) => s.toLowerCase().includes(q)),
	);
	if (!rows.length)
		return (
			<p className="px-3 py-4 text-muted-foreground">
				No task matches that search.
			</p>
		);

	// Grouped by bound in the order the engine sends — the group a person scans
	// is the group the envelope ceilings.
	const groups = new Map<string, CatalogueEntry[]>();
	for (const e of rows)
		groups.set(e.bound, [...(groups.get(e.bound) ?? []), e]);

	return (
		<div className="h-full overflow-y-auto pb-2">
			{[...groups].map(([bound, entries]) => (
				<section key={bound}>
					<Eyebrow aside={entries.length} className="px-3 pt-3 pb-1">
						<BoundChip bound={bound} />
					</Eyebrow>
					{entries.map((e) => (
						<RecordRow
							key={e.step_key}
							onClick={() => onOpenEntry(e.step_key)}
							title={<span className="font-mono">{e.step_key}</span>}
							subtitle={e.summary}
							// An unused callable is a fact, not an error (seams).
							status={
								e.used_by
									? `${e.used_by} plan${e.used_by === 1 ? "" : "s"}`
									: "unused"
							}
						/>
					))}
				</section>
			))}
		</div>
	);
}

/** The contract — bound · args · outputs · requires, in the section only. */
function EntryDetail({
	entry,
	onOpenEntry,
}: {
	entry: CatalogueEntry;
	onOpenEntry: (key: string | null) => void;
}) {
	return (
		<div className="flex h-full flex-col gap-4 overflow-y-auto px-3 py-4">
			<PropertyList>
				<PropertyRow label="Bound">
					<BoundChip bound={entry.bound} />
				</PropertyRow>
				<PropertyRow label="Does">{entry.summary}</PropertyRow>
				<PropertyRow label="Used by">
					{entry.used_by
						? `${entry.used_by} reusable plan${entry.used_by === 1 ? "" : "s"}`
						: "No plan names it yet"}
				</PropertyRow>
			</PropertyList>

			<section className="flex flex-col gap-1.5">
				<Eyebrow aside={entry.args.length || undefined}>Arguments</Eyebrow>
				{entry.args.length ? (
					<PropertyList>
						{entry.args.map((a) => (
							<PropertyRow key={a.name} label={a.name} mono>
								{a.type}
								{a.required ? " · required" : ""}
								{a.default != null ? ` · default ${String(a.default)}` : ""}
							</PropertyRow>
						))}
					</PropertyList>
				) : (
					<p className="text-muted-foreground">
						Takes nothing — it reads what the run already holds.
					</p>
				)}
			</section>

			<section className="flex flex-col gap-1.5">
				<Eyebrow aside={entry.outputs.length || undefined}>Outputs</Eyebrow>
				{entry.outputs.length ? (
					<PropertyList>
						{entry.outputs.map((o) => (
							<PropertyRow key={o.name} label={o.name} mono>
								{o.type} ·{" "}
								{o.rollup
									? `${o.rollup} across lanes`
									: "per lane only — bind it inside the lane"}
							</PropertyRow>
						))}
					</PropertyList>
				) : (
					<p className="text-muted-foreground">Declares no outputs.</p>
				)}
			</section>

			<section className="flex flex-col gap-1.5">
				<Eyebrow>Must come after</Eyebrow>
				{entry.requires.length ? (
					entry.requires.map((r) => (
						<RecordRow
							key={r}
							onClick={() => onOpenEntry(r)}
							title={<span className="font-mono">{r}</span>}
							subtitle={`A plan naming ${entry.step_key} must already order ${r} before it.`}
						/>
					))
				) : (
					<p className="text-muted-foreground">
						Nothing — a plan may place it anywhere.
					</p>
				)}
			</section>
		</div>
	);
}
