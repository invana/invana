// One drawer of a **stacked panel** — Library, Projects, Govern, Agents, Skills
// (graph-detail-page.md G32 · G33).
//
// **A drawer owns its header; the panel owns the status bar.** Each drawer
// draws its own title, count, search and filter, and a drill-in stays inside it
// — the header becomes `‹ PLANS / nl-single@4` while the other drawers keep
// their place. What is shared is one status bar in `footer.left` and one column
// width, so the stack has three headers and no panel chrome above them.
//
// This is the `ListPanelChrome` grammar (title · count · search · filter ·
// body) expressed as a `PanelStackSection` rather than a `PanelContent`: the
// kit's `PanelStack` already draws a collapsible, resizable header per section,
// so a drawer that wrapped itself in `ListPanelChrome` would draw two headers
// over one list.
//
// Search and filter state is **per drawer and owned by the stack**, not by this
// module: `PanelStack` renders a section's title and its body as siblings, so
// the state they share has to sit above both. {@link useTaskDrawerUi} is that
// holder, called once by the panel.

import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuTrigger,
	type NavHorizontalItem,
	type PanelStackSection,
	SearchInput,
	cn,
} from "@invana/ui";
import { ChevronLeft, Search, SlidersHorizontal } from "lucide-react";
import type { ElementType, ReactNode } from "react";
import { useCallback, useMemo, useState } from "react";

export interface TaskDrawerUiState {
	searchOpen: boolean;
	search: string;
	filterOpen: boolean;
}

const EMPTY_UI: TaskDrawerUiState = {
	searchOpen: false,
	search: "",
	filterOpen: false,
};

export interface TaskDrawerUi {
	get: (id: string) => TaskDrawerUiState;
	set: (id: string, patch: Partial<TaskDrawerUiState>) => void;
}

/**
 * Per-drawer search and filter state for one stack. The three lists filter on
 * different columns, so each drawer keeps its own — one shared bar would be
 * re-offered per list anyway (G33).
 */
export function useTaskDrawerUi(): TaskDrawerUi {
	const [state, setState] = useState<Record<string, TaskDrawerUiState>>({});

	const get = useCallback((id: string) => state[id] ?? EMPTY_UI, [state]);

	const set = useCallback(
		(id: string, patch: Partial<TaskDrawerUiState>) =>
			setState((prev) => ({
				...prev,
				[id]: { ...(prev[id] ?? EMPTY_UI), ...patch },
			})),
		[],
	);

	return useMemo(() => ({ get, set }), [get, set]);
}

export interface TaskDrawerSpec {
	/** The drawer's key — also the `?drawer=` value it focuses. */
	id: string;
	/** What this drawer is, in the header. `PLANS` · `CATALOGUE` · `TEMPLATES`. */
	label: string;
	/** A 14px lucide glyph before the label. */
	icon?: ElementType;
	/**
	 * The count beside the label — `24 · 2 running`, `7 reusable`,
	 * `25 · 5 bounds`. Always visible: a count is chrome that must read even
	 * while the drawer is collapsed.
	 */
	count?: ReactNode;
	/**
	 * What is drilled into, if anything. Present turns the header into
	 * `‹ RUNS / orders.csv`; the chevron calls `onBack`.
	 */
	trail?: ReactNode;
	onBack?: () => void;
	/** Body renderer — receives the live search string, empty when closed. */
	children: (ctx: { search: string }) => ReactNode;
	/**
	 * Actions before the search and filter icons — a drawer's own `+`, for the
	 * one thing it creates. Every create CTA for an item happens in the section
	 * that owns it (G3).
	 */
	headerActions?: {
		key: string;
		name: string;
		icon: ElementType;
		onClick: () => void;
	}[];
	/** Enables this drawer's own search toggle. */
	searchable?: boolean;
	searchPlaceholder?: string;
	/** This drawer's own filter menu content. Omit to hide the funnel. */
	filterMenu?: ReactNode;
	/** True while a filter is narrowing the list — lights the funnel. */
	filtered?: boolean;
	/** Start collapsed (header only). */
	defaultCollapsed?: boolean;
	/** The height this drawer takes while it is the focused one. */
	defaultSize?: number | string;
	minSize?: number | string;
}

/** Build one {@link PanelStackSection} from a drawer spec. */
export function taskDrawerSection(
	spec: TaskDrawerSpec,
	ui: TaskDrawerUi,
): PanelStackSection {
	const state = ui.get(spec.id);
	const drilled = spec.trail != null;
	const showSearch = !drilled && Boolean(spec.searchable) && state.searchOpen;

	return {
		id: spec.id,
		title: <DrawerTitle spec={spec} drilled={drilled} />,
		// **Every control goes in `headerActions`, and none of them in `title`.**
		// `PanelStack` renders the title *inside* the header's collapse button and
		// `headerActions` in a sibling beside it — so a control drawn in the title
		// was a `<button>` inside a `<button>`, and every click on one also toggled
		// the drawer. Opening search collapsed the drawer over the box it had just
		// opened. The kit's slot is the fix, not a `stopPropagation`.
		headerActions: drawerActions(spec, state, (patch) =>
			ui.set(spec.id, patch),
		),
		content: (
			<div className="flex h-full min-h-0 flex-col">
				{showSearch && (
					<div className="shrink-0 border-b p-2">
						<SearchInput
							autoFocus
							value={state.search}
							placeholder={spec.searchPlaceholder ?? `Search ${spec.label}`}
							onChange={(v) => ui.set(spec.id, { search: v })}
						/>
					</div>
				)}
				<div className="min-h-0 flex-1 overflow-auto">
					{spec.children({ search: showSearch ? state.search : "" })}
				</div>
			</div>
		),
		// The count and the two icons are chrome that must read while the drawer
		// is collapsed — the quiet-header default would hide exactly the controls
		// G33 puts in every drawer header.
		actionsOnHover: false,
		defaultCollapsed: spec.defaultCollapsed,
		defaultSize: spec.defaultSize,
		minSize: spec.minSize,
	};
}

/**
 * The drawer's header text — **and nothing interactive**.
 *
 * It renders inside `PanelStack`'s collapse button, so anything clickable here
 * is a nested button: invalid markup, and a click that toggles the drawer as
 * well as doing its own job. Every control lives in {@link drawerActions}.
 */
function DrawerTitle({
	spec,
	drilled,
}: {
	spec: TaskDrawerSpec;
	drilled: boolean;
}) {
	const Icon = spec.icon;

	return (
		<span className="flex min-w-0 flex-1 items-center gap-1.5">
			{drilled ? (
				<>
					<span className="shrink-0 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
						{spec.label}
					</span>
					<span className="shrink-0 text-muted-foreground">/</span>
					<span className="truncate font-semibold normal-case tracking-normal text-foreground">
						{spec.trail}
					</span>
				</>
			) : (
				<>
					{Icon ? <Icon className="h-3.5 w-3.5 shrink-0" /> : null}
					<span className="shrink-0 text-[11px] font-semibold uppercase tracking-wide">
						{spec.label}
					</span>
					{spec.count != null && (
						<span className="truncate text-[11px] font-normal normal-case tracking-normal text-muted-foreground">
							{spec.count}
						</span>
					)}
				</>
			)}
		</span>
	);
}

/**
 * Everything a drawer header can do, as `NavHorizontalItem`s.
 *
 * **Back is here rather than on the breadcrumb.** The artboard draws the
 * drilled header as `‹ RUNS / orders.csv`, with the chevron on the left; the
 * left of that bar is the collapse button, so a back control drawn there is a
 * button inside a button. It reads `RUNS / orders.csv` with `Back to RUNS`
 * beside the drawer's other controls until `PanelStack` offers a slot ahead of
 * its own chevron — at which point this row moves and nothing else changes.
 *
 * Search and filter apply to the list only, so a drilled-in drawer — showing
 * one record — offers neither: narrowing a list that is not on screen would be
 * a control with no subject.
 */
function drawerActions(
	spec: TaskDrawerSpec,
	state: TaskDrawerUiState,
	onSet: (patch: Partial<TaskDrawerUiState>) => void,
): NavHorizontalItem[] {
	const drilled = spec.trail != null;
	if (drilled) {
		return spec.onBack
			? [
					{
						key: "back",
						name: `Back to ${spec.label}`,
						icon: ChevronLeft,
						onClick: spec.onBack,
					},
				]
			: [];
	}

	const items: NavHorizontalItem[] = (spec.headerActions ?? []).map((a) => ({
		key: a.key,
		name: a.name,
		icon: a.icon,
		onClick: a.onClick,
	}));

	if (spec.searchable) {
		items.push({
			key: "search",
			name: "Search",
			icon: Search,
			onClick: () => onSet({ searchOpen: !state.searchOpen, search: "" }),
			className: state.searchOpen ? "bg-muted text-foreground" : undefined,
		});
	}

	if (spec.filterMenu) {
		// A **static** item — no `onClick`, no `menuItems` — so the kit renders a
		// plain `<div>` and the drawer keeps its own rich menu: labelled groups
		// and radio rows, which `menuItems` has no way to say. The item still
		// earns the row's tooltip and its place in the strip.
		items.push({
			key: "filter",
			name: "Filter",
			label: (
				<DropdownMenu
					open={state.filterOpen}
					onOpenChange={(o) => onSet({ filterOpen: o })}
				>
					<DropdownMenuTrigger asChild>
						<button
							type="button"
							className={cn(
								"flex items-center rounded",
								(state.filterOpen || spec.filtered) && "text-foreground",
							)}
						>
							<SlidersHorizontal
								className={cn("h-3.5 w-3.5", spec.filtered && "text-primary")}
							/>
						</button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="end" className="w-56">
						{spec.filterMenu}
					</DropdownMenuContent>
				</DropdownMenu>
			),
		});
	}

	return items;
}
