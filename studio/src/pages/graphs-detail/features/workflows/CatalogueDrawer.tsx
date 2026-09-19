// **Catalogue** — the third drawer of the Tasks stack (the-catalogue.md 7.6).
//
// The closed vocabulary a plan may name at all: one entry per callable, grouped
// by the bound it spends (graph-detail-page.md §3a). It is the definition of
// the drawer above it, the way Plans is the definition of Runs — which is why
// the three are stacked rather than given three icons.
//
// The list itself renders `runtime/catalogue/registry.py` through
// `GET …/catalogue`, never a second copy of the declaration (CA2). That route
// is built in S4, so until it answers this drawer says what the catalogue *is*
// rather than drawing an empty list — an empty state that explains a surface
// nobody has seen before is the more useful of the two.

import {
	type TaskDrawerUi,
	taskDrawerSection,
} from "@/pages/graphs-detail/shared/TaskDrawer";
import { EmptyState, type PanelStackSection } from "@invana/ui";
import { BookMarked } from "lucide-react";

export interface CatalogueDrawerProps {
	ui: TaskDrawerUi;
	/** `&entry=` — the entry whose detail replaces this drawer's body (CA6). */
	entryKey: string | null;
	onOpenEntry: (key: string | null) => void;
	defaultSize?: number | string;
	defaultCollapsed?: boolean;
}

export function catalogueDrawerSection({
	ui,
	entryKey,
	onOpenEntry,
	defaultSize,
	defaultCollapsed,
}: CatalogueDrawerProps): PanelStackSection {
	return taskDrawerSection(
		{
			id: "catalogue",
			label: "Catalogue",
			icon: BookMarked,
			trail: entryKey ?? undefined,
			onBack: () => onOpenEntry(null),
			defaultSize,
			defaultCollapsed,
			children: () => (
				<EmptyState
					className="p-4"
					title="The vocabulary a plan may name"
					description="Every task a plan can dispatch is declared once, in the runtime's catalogue, with the bound it spends and the outputs it promises. A plan that names anything else is refused before it runs."
				/>
			),
		},
		ui,
	);
}
