import {
	Popover,
	PopoverContent,
	PopoverTrigger,
	TabbedPanel,
} from "@invana/ui";
import {
	HelpCircle,
	History,
	PanelRightClose,
	PanelRightOpen,
	Pencil,
	Plus,
	Search,
	SlidersHorizontal,
	X,
} from "lucide-react";
import type { ComponentType, SyntheticEvent } from "react";
import { useEffect, useRef } from "react";

export interface CanvasTab {
	id: string;
	title: string;
}

interface Props {
	tabs: CanvasTab[];
	activeId: string | null;
	onSelect: (id: string) => void;
	onClose: (id: string) => void;
	onEdit: (id: string) => void;
	onNew: () => void;
	/** True while a new-canvas create is in flight (disables "+"). */
	isCreating: boolean;
	/** Open the session tutorial ("what you can do"). */
	onHelp: () => void;
	/** Toggle the per-type styling panel. */
	onStyle: () => void;
	/** Toggle the version-history timeline panel (RFC-047). */
	onHistory: () => void;
	/** Inspector panel currently collapsed? Drives the show/hide toggle. */
	inspectorClosed: boolean;
	/** Toggle the right-side inspector panel open/closed. */
	onToggleInspector: () => void;
}

const stop = (e: SyntheticEvent) => e.stopPropagation();

/**
 * An inline tab affordance (edit / close). It lives inside a Radix
 * <TabsTrigger> (itself a <button>), where a nested native <button> is invalid,
 * so it's a role="button" span. It stops propagation so activating it edits or
 * closes without also switching tabs.
 */
function TabControl({
	icon: Icon,
	iconClassName,
	title,
	onActivate,
}: {
	icon: ComponentType<{ className?: string }>;
	iconClassName: string;
	title: string;
	onActivate: () => void;
}) {
	const activate = (e: SyntheticEvent) => {
		stop(e);
		onActivate();
	};
	return (
		// biome-ignore lint/a11y/useSemanticElements: a native <button> can't nest inside the Radix TabsTrigger <button> hosting this label.
		<span
			role="button"
			tabIndex={0}
			className="opacity-0 group-hover:opacity-100"
			title={title}
			onPointerDown={stop}
			onClick={activate}
			onKeyDown={(e) => {
				if (e.key === "Enter" || e.key === " ") activate(e);
			}}
		>
			<Icon className={iconClassName} />
		</span>
	);
}

/** A canvas tab's label: title plus inline edit/close affordances. */
function TabLabel({
	title,
	onEdit,
	onClose,
}: {
	title: string;
	onEdit: () => void;
	onClose: () => void;
}) {
	// A tab shows its session's title (RFC-045). Match the breadcrumb's empty-name
	// fallback so an unnamed session reads the same in both places.
	const label = title || "New session";
	return (
		<span className="group flex items-center gap-1">
			<span className="max-w-[160px] truncate text-left" title={label}>
				{label}
			</span>
			<TabControl
				icon={Pencil}
				iconClassName="h-3 w-3"
				title="Edit title & purpose"
				onActivate={onEdit}
			/>
			<TabControl
				icon={X}
				iconClassName="h-3.5 w-3.5"
				title="Close tab"
				onActivate={onClose}
			/>
		</span>
	);
}

/**
 * A right-side action for a feature that isn't built yet: an icon that opens a
 * small "coming soon" popover. Passed as a NavItem `icon` with no `onClick`, so
 * NavItems wraps it in a plain <div> — keeping the popover's <button> trigger
 * out of a nested-button. NavItems hands the icon `className`/`strokeWidth`.
 */
function comingSoon(
	Icon: ComponentType<{ className?: string }>,
	label: string,
	blurb: string,
) {
	return function StubAction({ className }: { className?: string }) {
		return (
			<Popover>
				<PopoverTrigger asChild>
					<button
						type="button"
						className="flex items-center justify-center"
						title={label}
					>
						<Icon className={className} />
					</button>
				</PopoverTrigger>
				<PopoverContent align="end" className="w-56">
					<p className="text-sm font-medium">{label}</p>
					<p className="text-sm text-muted-foreground">{blurb}</p>
				</PopoverContent>
			</Popover>
		);
	};
}

/**
 * The Explorer main-section header (RFC-043): open-canvas tabs on the left with
 * a "+" to start a blank canvas, and right-side canvas actions (display
 * settings, find-in-canvas, inspector toggle). Built on @invana/ui TabbedPanel
 * as a header-only strip — the canvas itself stays mounted as a sibling below,
 * so switching tabs never remounts it. A click selects a tab (switching the
 * active canvas + its session); the pencil edits title/purpose; the × closes
 * the tab (the canvas stays saved in the Canvases list).
 */
export function CanvasTabsBar({
	tabs,
	activeId,
	onSelect,
	onClose,
	onEdit,
	onNew,
	isCreating,
	onHelp,
	onStyle,
	onHistory,
	inspectorClosed,
	onToggleInspector,
}: Props) {
	// The tab list scrolls horizontally (see headerClassName below). When the
	// active canvas changes — notably when a freshly-created one is appended at
	// the far right — bring its trigger into view so its title isn't left
	// clipped at the edge.
	const containerRef = useRef<HTMLDivElement>(null);
	useEffect(() => {
		if (!activeId) return;
		containerRef.current
			?.querySelector('[role="tab"][data-state="active"]')
			?.scrollIntoView({ inline: "nearest", block: "nearest" });
	}, [activeId]);

	const tabConfigs = tabs.map((t) => ({
		value: t.id,
		label: (
			<TabLabel
				title={t.title}
				onEdit={() => onEdit(t.id)}
				onClose={() => onClose(t.id)}
			/>
		),
		content: null,
	}));

	return (
		<div ref={containerRef} className="h-[30px] shrink-0">
			<TabbedPanel
				activeTab={activeId ?? undefined}
				onTabChange={onSelect}
				tabs={tabConfigs}
				// TabbedPanel's Card is boxed; keep only its bottom border to match
				// the old strip, and collapse the (empty) body so it's header-only.
				className="[&>div]:border-x-0 [&>div]:border-t-0"
				// Many open canvases would otherwise stretch the tab list and push
				// the right-side actions off-screen. Let the tab list (role=tablist,
				// the header's first child) shrink below its content and scroll
				// horizontally, and pin the actions group (last child) so it never
				// gets squeezed out.
				headerClassName="[&>[role=tablist]]:min-w-0 [&>[role=tablist]]:overflow-x-auto [&>[role=tablist]]:overflow-y-hidden [&>div:last-child]:shrink-0"
				bodyClassName="hidden"
				headerActions={{
					rightNavItems: [
						// "+" lives in the pinned actions group (not the scrolling tab
						// list) so it stays visible however many canvases are open. No
						// onClick while a create is in flight makes it non-interactive.
						{
							key: "new-canvas",
							name: "New canvas",
							icon: Plus,
							onClick: isCreating ? undefined : onNew,
							iconClassName: isCreating ? "opacity-40" : undefined,
							showSeperator: true,
						},
						{
							key: "help",
							name: "What can I do here?",
							icon: HelpCircle,
							onClick: onHelp,
						},
						{
							key: "display",
							name: "Styling",
							icon: SlidersHorizontal,
							onClick: onStyle,
						},
						{
							key: "history",
							name: "History",
							icon: History,
							onClick: onHistory,
						},
						{
							key: "find",
							name: "Find in canvas",
							icon: comingSoon(
								Search,
								"Find in canvas",
								"Search within this canvas is coming soon.",
							),
							showSeperator: true,
						},
						{
							key: "inspector",
							name: inspectorClosed
								? "Show inspector panel"
								: "Hide inspector panel",
							icon: inspectorClosed ? PanelRightOpen : PanelRightClose,
							onClick: onToggleInspector,
						},
					],
				}}
			/>
		</div>
	);
}
