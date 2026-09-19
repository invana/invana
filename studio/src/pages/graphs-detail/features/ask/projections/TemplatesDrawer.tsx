// **Templates** — the third drawer of the Library stack (graph-detail-page.md
// G38 · G41).
//
// A projection template is to an answer what a plan is to a run: both are
// definitions, both are promoted from what served (projections.md C7). So it has
// no `leftNav` item of its own and sits under `Plans` and `Catalogue`, which are
// the other two things a run is composed from — the same rule G14 applies to
// Stitches: a library you open while authoring is not a place you go.
//
// The drawer owns the header — label, count, search, filter and the `+` that
// authors one (G32 · G3). The body is `TemplatesDrawerBody`.

import {
	TemplateTrail,
	TemplatesCount,
	TemplatesDrawerBody,
} from "@/pages/graphs-detail/features/ask/projections/TemplatesPanel";
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
import { Plus, Table2 } from "lucide-react";

/** `kind` and `surface` — the two columns this list is narrowed on (§3a). */
export const TEMPLATE_KINDS = ["result", "prompt"] as const;
export const TEMPLATE_SURFACES = [
	"table",
	"metric",
	"chart",
	"subgraph",
	"markdown",
] as const;

export interface TemplatesDrawerProps {
	username: string;
	graphSlug: string;
	ui: TaskDrawerUi;
	/** `&template=` — the template whose detail replaces this drawer's body. */
	templateId: string | null;
	onOpenTemplate: (id: string | null) => void;
	/** The drawer's `+` — authoring happens in the section that owns it (G3). */
	authoring: boolean;
	onAuthoring: (v: boolean) => void;
	kindFilter: string;
	onKindFilter: (v: string) => void;
	surfaceFilter: string;
	onSurfaceFilter: (v: string) => void;
	defaultSize?: number | string;
	defaultCollapsed?: boolean;
}

export function templatesDrawerSection({
	username,
	graphSlug,
	ui,
	templateId,
	onOpenTemplate,
	authoring,
	onAuthoring,
	kindFilter,
	onKindFilter,
	surfaceFilter,
	onSurfaceFilter,
	defaultSize,
	defaultCollapsed,
}: TemplatesDrawerProps): PanelStackSection {
	return taskDrawerSection(
		{
			id: "templates",
			label: "Templates",
			icon: Table2,
			count: <TemplatesCount username={username} graphSlug={graphSlug} />,
			// Authoring is a body, not a record — so it borrows the drill-in header
			// (`‹ TEMPLATES / new`) rather than inventing a second way back.
			trail: templateId ? (
				<TemplateTrail
					username={username}
					graphSlug={graphSlug}
					id={templateId}
				/>
			) : authoring ? (
				"new"
			) : undefined,
			onBack: () => {
				onAuthoring(false);
				onOpenTemplate(null);
			},
			searchable: true,
			searchPlaceholder: "Search templates",
			headerActions: [
				{
					key: "new",
					name: "Author a template",
					icon: Plus,
					onClick: () => {
						onOpenTemplate(null);
						onAuthoring(true);
					},
				},
			],
			filtered: Boolean(kindFilter || surfaceFilter),
			filterMenu: (
				<>
					<DropdownMenuLabel>Kind</DropdownMenuLabel>
					<DropdownMenuRadioGroup
						value={kindFilter || "all"}
						onValueChange={(v) => onKindFilter(v === "all" ? "" : v)}
					>
						<DropdownMenuRadioItem value="all">
							both kinds
						</DropdownMenuRadioItem>
						{TEMPLATE_KINDS.map((k) => (
							<DropdownMenuRadioItem key={k} value={k}>
								{k}
							</DropdownMenuRadioItem>
						))}
					</DropdownMenuRadioGroup>
					<DropdownMenuSeparator />
					<DropdownMenuLabel>Surface</DropdownMenuLabel>
					<DropdownMenuRadioGroup
						value={surfaceFilter || "all"}
						onValueChange={(v) => onSurfaceFilter(v === "all" ? "" : v)}
					>
						<DropdownMenuRadioItem value="all">
							every surface
						</DropdownMenuRadioItem>
						{TEMPLATE_SURFACES.map((s) => (
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
				<TemplatesDrawerBody
					username={username}
					graphSlug={graphSlug}
					search={search}
					kindFilter={kindFilter}
					surfaceFilter={surfaceFilter}
					selectedId={templateId}
					onSelect={onOpenTemplate}
					authoring={authoring}
					onAuthored={() => onAuthoring(false)}
				/>
			),
		},
		ui,
	);
}
