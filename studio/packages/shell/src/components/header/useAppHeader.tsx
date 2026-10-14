import {
	Breadcrumb,
	BreadcrumbEllipsis,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
	BreadcrumbPage,
	BreadcrumbSeparator,
	cn,
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
	Separator,
} from "@invana/ui";
import { useAuth } from "@invana-studio/core";
import { Fragment, type ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { SearchTrigger } from "../../palette/CommandPalette";
import { useActiveProduct, useRouteCrumbs } from "../../products";
import { ActivityBell } from "./ActivityBell";
import { GraphSwitcher } from "./GraphSwitcher";
import { Launcher } from "./Launcher";
import { UserMenu } from "./UserMenu";

export interface AppHeaderOptions {
	/** Replaces the levels after the lead. Defaults to the matched routes'
	 *  crumbs on a Graph, and a label from the URL elsewhere (Graphs, New
	 *  graph, Profile). */
	pageLabel?: string;
	/** The object open on this screen — the canvas, the model, the agent. Drawn
	 *  as the last crumb: `airways ▾ › Sessions › Routes out of LHR`. Omitted
	 *  when the screen holds nothing yet. */
	objectLabel?: string;
	/** The levels after the lead when the focused page names its own —
	 *  `Projects › a project › H2 › f1`. Wins over the route's crumbs. */
	pageTrail?: HeaderLevel[];
	/** Center content. Most pages won't need this. */
	center?: ReactNode;
	/** Page-specific controls, first in `header.right` — the Explorer's *Tools*. */
	rightExtras?: ReactNode;
	/** The Assistant toggle, just before the user menu. */
	assistantToggle?: ReactNode;
}

/**
 * The shell's `header`, the same on every screen:
 *
 *   [launcher] Invana <Product> | [graph ▾] › level › level   [center]   [rightExtras] [⌘K] [Notifications] [Assistant] [user menu]
 *
 * The wordmark names the open product, and `Invana Studio` where none is
 * open. Theme and set-up live in the user menu, not here.
 *
 * Breadcrumb behaviour (after the wordmark):
 * - Graph-scoped (`/u/:username/:graphSlug/…`): the Graph switcher, then one
 *   level per matched route that names a `handle.crumb` — section › item ›
 *   drill-in — then `› object` when something is open on it. Every level but
 *   the last links to its path; a tab is a query param, so it is never a level.
 * - Otherwise: `@username / pageLabel` (e.g. `@ravi-merugu / Graphs`), or,
 *   on an install-wide product's route, `@username ›` its route crumbs.
 * - If logged out, the leading user segment is dropped.
 * - More than four levels collapse to the first · `…` · the last two; `…`
 *   opens a menu of the hidden levels.
 * - A long name truncates; its full text is on hover.
 */
export function useAppHeader(options: AppHeaderOptions = {}) {
	const {
		pageLabel,
		objectLabel,
		pageTrail,
		center,
		rightExtras,
		assistantToggle,
	} = options;
	const { pathname } = useLocation();
	const { user } = useAuth();
	const product = useActiveProduct();
	const routeCrumbs = useRouteCrumbs();

	const trail = computeTrail(
		pathname,
		user?.username,
		pageLabel,
		pageTrail?.length ? pageTrail : routeCrumbs,
	);
	if (objectLabel) trail.levels.push({ label: objectLabel });
	const inGraph = GRAPH_PATH.test(pathname);
	const hasTrail = trail.lead.length + trail.levels.length > 0;

	return {
		// `relative` makes the header bar a positioning context so a `center`
		// consumer can dead-center its content against the full header width
		// rather than only within the space between the trail and the controls.
		className: "relative",
		left: (
			<div className="flex items-center gap-2 px-2 min-w-0">
				<Launcher />
				<Link
					to="/graphs"
					className="select-none whitespace-nowrap text-base hover:opacity-80 transition-opacity"
				>
					<span className="font-bold">Invana</span>{" "}
					<span className="text-muted-foreground">
						{product?.name ?? "Studio"}
					</span>
				</Link>
				{(hasTrail || inGraph) && (
					<Separator orientation="vertical" className="h-4" />
				)}
				{inGraph && <GraphSwitcher />}
				{hasTrail && (
					<HeaderBreadcrumb trail={trail} leadingSeparator={inGraph} />
				)}
			</div>
		),
		center,
		right: (
			<div className="flex items-center gap-1 px-2">
				{rightExtras}
				<SearchTrigger />
				<ActivityBell />
				{assistantToggle}
				<UserMenu />
			</div>
		),
	};
}

// ─────────────────────────────────────────────────────────────────────────────
// Breadcrumb
// ─────────────────────────────────────────────────────────────────────────────

/** One level of the header's trail. */
interface HeaderLevel {
	/** Display text. */
	label: string;
	/** Optional link target — a path, with a query when the level is one. Last segment is unlinked. */
	to?: string;
	/** Hover text when the label is shortened; the label otherwise. */
	title?: string;
}

type Segment = HeaderLevel;

/** `lead` names where the levels are — the Graph, or the signed-in user. */
interface Trail {
	lead: Segment[];
	levels: Segment[];
}

/** Levels shown before the middle collapses, the lead counting as one. */
const MAX_LEVELS = 4;

/** `/u/:username/:graphSlug/…` — a screen inside a Graph. */
const GRAPH_PATH = /^\/u\/[^/]+\/[^/]+(?:\/.*)?$/;

const SEPARATOR_CLASS =
	"shrink-0 text-muted-foreground/60 [&>svg]:h-3.5 [&>svg]:w-3.5";

function HeaderBreadcrumb({
	trail,
	leadingSeparator,
}: {
	trail: Trail;
	/** A `›` before the first level — after the Graph switcher. */
	leadingSeparator: boolean;
}) {
	const { lead, levels } = trail;
	const levelCount = (lead.length > 0 ? 1 : 0) + levels.length;
	const collapse = levelCount > MAX_LEVELS;
	const hidden = collapse ? levels.slice(0, -2) : [];
	const shown = collapse ? levels.slice(-2) : levels;
	const segments = [...lead, ...shown];
	// The `…` sits after the lead, before the last two levels.
	const ellipsisAt = collapse ? lead.length : -1;

	return (
		<Breadcrumb className="min-w-0">
			<BreadcrumbList className="flex-nowrap gap-1 sm:gap-1">
				{leadingSeparator && (
					<BreadcrumbSeparator className={SEPARATOR_CLASS} />
				)}
				{segments.map((s, i) => {
					const isLast = i === segments.length - 1;
					return (
						<Fragment
							key={`${s.label}-${
								// biome-ignore lint/suspicious/noArrayIndexKey: the list is rebuilt whole, never reordered in place
								i
							}`}
						>
							{i > 0 && <BreadcrumbSeparator className={SEPARATOR_CLASS} />}
							{i === ellipsisAt && (
								<>
									<HiddenLevels levels={hidden} />
									<BreadcrumbSeparator className={SEPARATOR_CLASS} />
								</>
							)}
							<BreadcrumbItem className="min-w-0">
								{s.to && !isLast ? (
									<BreadcrumbLink asChild className="truncate">
										<Link to={s.to} title={s.title ?? s.label}>
											{s.label}
										</Link>
									</BreadcrumbLink>
								) : (
									<BreadcrumbPage
										title={s.title ?? s.label}
										className={cn(
											"truncate",
											isLast ? "font-medium" : "text-muted-foreground",
										)}
									>
										{s.label}
									</BreadcrumbPage>
								)}
							</BreadcrumbItem>
						</Fragment>
					);
				})}
			</BreadcrumbList>
		</Breadcrumb>
	);
}

/** The collapsed middle of a long trail: `…`, opening a menu of its levels. */
function HiddenLevels({ levels }: { levels: Segment[] }) {
	const navigate = useNavigate();
	return (
		<BreadcrumbItem>
			<DropdownMenu>
				<DropdownMenuTrigger aria-label="Show hidden levels">
					<BreadcrumbEllipsis className="h-4 w-4" />
				</DropdownMenuTrigger>
				<DropdownMenuContent side="bottom" align="start">
					{levels.map((level) => (
						<DropdownMenuItem
							key={`${level.to ?? ""}-${level.label}`}
							onSelect={() => level.to && navigate(level.to)}
						>
							{level.label}
						</DropdownMenuItem>
					))}
				</DropdownMenuContent>
			</DropdownMenu>
		</BreadcrumbItem>
	);
}

// ─────────────────────────────────────────────────────────────────────────────
// Path → trail
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Derive the trail from the URL and the matched routes' crumbs. The
 * `pageLabel` arg overrides the levels when callers want something more
 * specific than the URL yields.
 */
function computeTrail(
	pathname: string,
	username: string | undefined,
	override: string | undefined,
	routeCrumbs: Segment[],
): Trail {
	// Inside a Graph the switcher is the lead, so the trail is only the levels
	// after it.
	if (GRAPH_PATH.test(pathname))
		return {
			lead: [],
			levels: override ? [{ label: override }] : [...routeCrumbs],
		};

	// Non-graph routes (/graphs, /graphs/new, /settings/profile, /login, ...).
	// An install-wide product's routes name their own levels (`Imports`).
	const lead = username ? [{ label: `@${username}`, to: "/graphs" }] : [];
	if (!override && routeCrumbs.length)
		return { lead, levels: [...routeCrumbs] };
	const pageLabel = override ?? labelFromPlainPath(pathname);
	return { lead, levels: pageLabel ? [{ label: pageLabel }] : [] };
}

function labelFromPlainPath(pathname: string): string | undefined {
	if (pathname === "/" || pathname === "/graphs") return "Graphs";
	if (pathname === "/graphs/new") return "New graph";
	if (pathname.startsWith("/settings/profile")) return "Profile";
	return undefined;
}
