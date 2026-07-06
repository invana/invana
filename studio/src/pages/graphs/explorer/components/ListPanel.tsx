// Reusable left-rail list panel chrome (RFC-043).
//
// The Sessions panel established the shape of every Explorer left rail: a
// `TabbedPanel` with a persistent tab, an icon-only header (refresh · search ·
// sort/filter · collapse), a togglable search box, a header-anchored filter
// menu, and a list of rows whose per-item actions reveal on hover. This module
// factors that behaviour out so Sessions, Canvases and future rails share one
// implementation instead of drifting.
//
// - `ListPanelChrome` — the panel frame (tab + header actions + search + filter
//   dropdown + optional footer). Owns the search/filter open state and hands the
//   live search string back through a render-prop child so the body can filter.
// - `ListRow` — the row shell: a click target with a leading slot, a truncating
//   title/subtitle, an active highlight, and a hover-revealed action cluster.
// - `ListFilterMenu` — the sort + show-archived + reset dropdown content, with a
//   slot for panel-specific filters (e.g. Sessions' per-LLM toggles).

import {
	DropdownMenu,
	DropdownMenuCheckboxItem,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
	SearchInput,
	TabbedPanel,
} from "@invana/ui";
import {
	PanelLeftClose,
	RefreshCw,
	Search,
	SlidersHorizontal,
} from "lucide-react";
import type { ElementType, ReactNode } from "react";
import { useState } from "react";

// Sort is the same two-way toggle everywhere the engine lists entities.
export type ListSort = "updated" | "created";

// A single header icon-button, matching TabbedPanel's `rightNavItems` shape.
export interface ListHeaderAction {
	key: string;
	name: string;
	icon: ElementType;
	iconClassName?: string;
	onClick: () => void;
}

export interface ListPanelChromeProps {
	/** The single persistent tab (label + icon) this rail shows. */
	tab: { value: string; label: ReactNode; icon?: ElementType };
	/** Body renderer — receives the live search string (empty when the search
	 *  box is closed) so the list can filter against it. */
	children: (ctx: { search: string }) => ReactNode;
	/** Refetch handler for the header's refresh control. Omit to hide it. */
	onRefresh?: () => void;
	/** Spins the refresh icon while a refetch is in flight. */
	isRefreshing?: boolean;
	refreshLabel?: string;
	/** Enables the search toggle + box. */
	searchable?: boolean;
	searchLabel?: string;
	/** Filter dropdown content (typically a {@link ListFilterMenu}). Omit to
	 *  hide the funnel. */
	filterMenu?: ReactNode;
	filterLabel?: string;
	/** Collapse handler for the header's panel-close control. Omit to hide it. */
	onClose?: () => void;
	closeLabel?: string;
	/** Extra header actions prepended before refresh (e.g. Canvases' "Save view"). */
	leadingActions?: ListHeaderAction[];
	/** Whether the search + filter controls apply right now. Panels with a
	 *  detail view (Sessions' thread) pass `false` there to hide them. Default true. */
	listControls?: boolean;
	/** Pinned-to-bottom content below the scrolling body (e.g. a composer). */
	footer?: ReactNode;
}

/**
 * The shared left-rail frame. Renders a {@link TabbedPanel} with one tab, an
 * icon-only header, an optional search box and a header-anchored filter menu.
 */
export function ListPanelChrome({
	tab,
	children,
	onRefresh,
	isRefreshing,
	refreshLabel = "Refresh",
	searchable = false,
	searchLabel = "Search",
	filterMenu,
	filterLabel = "Sort & filter",
	onClose,
	closeLabel = "Collapse panel",
	leadingActions,
	listControls = true,
	footer,
}: ListPanelChromeProps) {
	const [searchOpen, setSearchOpen] = useState(false);
	const [search, setSearch] = useState("");
	const [filterOpen, setFilterOpen] = useState(false);

	// Search + filter only make sense on the list; a panel in its detail view
	// passes listControls=false, which also neutralises the search string.
	const showSearch = searchable && listControls && searchOpen;
	const activeSearch = showSearch ? search : "";

	const rightNavItems: ListHeaderAction[] = [...(leadingActions ?? [])];
	if (onRefresh) {
		rightNavItems.push({
			key: "refresh",
			name: refreshLabel,
			icon: RefreshCw,
			iconClassName: isRefreshing ? "animate-spin" : undefined,
			onClick: onRefresh,
		});
	}
	if (listControls && searchable) {
		rightNavItems.push({
			key: "search",
			name: searchLabel,
			icon: Search,
			onClick: () => {
				setSearchOpen((v) => !v);
				setSearch("");
			},
		});
	}
	if (listControls && filterMenu) {
		rightNavItems.push({
			key: "filter",
			name: filterLabel,
			icon: SlidersHorizontal,
			onClick: () => setFilterOpen((v) => !v),
		});
	}
	if (onClose) {
		rightNavItems.push({
			key: "close",
			name: closeLabel,
			icon: PanelLeftClose,
			onClick: onClose,
		});
	}

	// The composer/footer lives inside the tab content (not TabbedPanel's
	// `footerContent`): the panel sizes its body to `calc(100% - header)` and
	// stacks the footer below that, so a real footer would overflow. As a
	// bottom-pinned flex child, the body scrolls above and the footer stays put.
	const content = (
		<div className="relative flex flex-col h-full min-h-0">
			{/* The panel header API only renders icon buttons, so the filter funnel
			    toggles this controlled menu anchored to an invisible corner element —
			    the menu floats just under the header's funnel icon. */}
			{filterMenu && (
				<DropdownMenu open={filterOpen} onOpenChange={setFilterOpen}>
					<DropdownMenuTrigger asChild>
						<span
							aria-hidden
							className="pointer-events-none absolute right-2 top-0 h-0 w-0"
						/>
					</DropdownMenuTrigger>
					{filterMenu}
				</DropdownMenu>
			)}
			<div className="flex flex-1 min-h-0 flex-col">
				{showSearch && (
					<div className="p-2 border-b border-border shrink-0">
						<SearchInput value={search} onChange={setSearch} />
					</div>
				)}
				<div className="flex-1 min-h-0">
					{children({ search: activeSearch })}
				</div>
			</div>
			{footer && <div className="shrink-0">{footer}</div>}
		</div>
	);

	return (
		<TabbedPanel
			defaultTab={tab.value}
			tabs={[
				{
					value: tab.value,
					label: tab.label,
					icon: tab.icon,
					content,
				},
			]}
			headerActions={{ rightNavItems }}
		/>
	);
}

// ── Filter menu ──────────────────────────────────────────────────────────────

export interface ListFilterMenuProps {
	sort: ListSort;
	onSortChange: (sort: ListSort) => void;
	showArchived: boolean;
	onShowArchivedChange: (show: boolean) => void;
	onReset: () => void;
	/** Panel-specific filter rows, inserted between sort and "Show archived"
	 *  (e.g. Sessions' per-LLM checkboxes). */
	children?: ReactNode;
}

/**
 * The sort + filter dropdown content (the header funnel). Items keep the menu
 * open on select so several filters can be adjusted in one pass.
 */
export function ListFilterMenu({
	sort,
	onSortChange,
	showArchived,
	onShowArchivedChange,
	onReset,
	children,
}: ListFilterMenuProps) {
	const keepOpen = (e: Event) => e.preventDefault();
	return (
		<DropdownMenuContent align="end" sideOffset={8} className="w-52">
			<DropdownMenuRadioGroup
				value={sort}
				onValueChange={(v) => onSortChange(v as ListSort)}
			>
				<DropdownMenuRadioItem value="created" onSelect={keepOpen}>
					Sort by Created
				</DropdownMenuRadioItem>
				<DropdownMenuRadioItem value="updated" onSelect={keepOpen}>
					Sort by Updated
				</DropdownMenuRadioItem>
			</DropdownMenuRadioGroup>

			{children}

			<DropdownMenuSeparator />
			<DropdownMenuCheckboxItem
				checked={showArchived}
				onCheckedChange={onShowArchivedChange}
				onSelect={keepOpen}
			>
				Show archived
			</DropdownMenuCheckboxItem>

			<DropdownMenuSeparator />
			<DropdownMenuItem onSelect={onReset}>Reset</DropdownMenuItem>
		</DropdownMenuContent>
	);
}

// ── List row ──────────────────────────────────────────────────────────────────

export interface ListRowProps {
	/** Highlights the row (e.g. the canvas currently painted). */
	active?: boolean;
	onClick: () => void;
	/** Leading slot before the title — a status dot, pin, etc. */
	leading?: ReactNode;
	/** Preview slot rendered above the title (e.g. a canvas banner thumbnail). */
	banner?: ReactNode;
	title: ReactNode;
	subtitle?: ReactNode;
	/** Hover-revealed action cluster (icon buttons). Rendered top-right; each
	 *  button should `stopPropagation` so it doesn't trigger the row click. */
	actions?: ReactNode;
	/** Right padding reserved on the title so it truncates clear of `actions`.
	 *  Default reserves room on hover only. */
	titlePadding?: string;
}

/**
 * A single list row: a full-width click target with a leading slot, a
 * truncating title/subtitle, and a hover-revealed action cluster. The main
 * target is a real `<button>`; the actions are absolutely-positioned siblings
 * (not nested) so the markup stays valid.
 */
export function ListRow({
	active,
	onClick,
	leading,
	banner,
	title,
	subtitle,
	actions,
	titlePadding = "pr-2 group-hover:pr-12",
}: ListRowProps) {
	return (
		<div
			className={`group relative flex items-stretch transition-colors hover:bg-accent ${
				active ? "bg-accent" : ""
			}`}
		>
			<button
				type="button"
				onClick={onClick}
				className="flex flex-1 min-w-0 items-start gap-2.5 text-left px-4 py-2"
			>
				{leading}
				<span className="min-w-0 flex-1">
					{banner}
					<span className={`block truncate text-foreground ${titlePadding}`}>
						{title}
					</span>
					{subtitle && (
						<span className="flex items-center gap-1.5 text-sm text-muted-foreground">
							{subtitle}
						</span>
					)}
				</span>
			</button>

			{actions && (
				<div className="absolute right-2 top-1.5 flex items-center gap-0.5">
					{actions}
				</div>
			)}
		</div>
	);
}
