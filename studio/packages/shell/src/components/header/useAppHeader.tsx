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
import { FullscreenToggle } from "../FullscreenToggle";
import { GitHubStars } from "../GitHubStars";
import { ThemeMenu } from "../ThemeMenu";
import { ActivityBell } from "./ActivityBell";
import { Launcher } from "./Launcher";
import { GraphOnboardingCap } from "./OnboardingCap";
import { UserMenu } from "./UserMenu";

export interface AppHeaderOptions {
	/** Replaces the levels after the lead. Defaults to the matched routes'
	 *  crumbs on a Graph, and a label from the URL elsewhere (Graphs, New
	 *  graph, Profile). */
	pageLabel?: string;
	/** The object open on this screen — the canvas, the model, the agent. Drawn
	 *  as the last crumb: `owner › graph › Explorer › Defence theme`. Omitted
	 *  when the screen holds nothing yet. */
	objectLabel?: string;
	/** The Graph picker slot, after the wordmark. */
	graphPicker?: ReactNode;
	/** Center content. Most pages won't need this. */
	center?: ReactNode;
	/** The ⌘K slot, first in `header.right`. Defaults to the search field that opens the palette. */
	search?: ReactNode;
	/** Page-specific controls, left of the shared ones. */
	rightExtras?: ReactNode;
	/** Graph-scoped status, before the theme menu. Defaults to the onboarding
	 *  cap inside a Graph. */
	status?: ReactNode;
	/** The notifications slot. Defaults to the bell that opens Activity. */
	notifications?: ReactNode;
	/** The Assistant toggle, just before the user menu. */
	assistantToggle?: ReactNode;
}

/**
 * The shell's `header`, the same on every screen:
 *
 *   [launcher] [Invana <Product>] | [graph picker] breadcrumb   [center]   [⌘K] [rightExtras] [GitHubStars] [status] [ThemeMenu] [FullscreenToggle] [notifications] [assistant] [user menu]
 *
 * The wordmark names the open product, and `Invana Studio` where none is
 * open. Each slot is empty until a page or a later product fills it.
 *
 * Breadcrumb behaviour (after the wordmark):
 * - Graph-scoped (`/u/:username/:graphSlug/…`): `owner › graph`, then one
 *   level per matched route that names a `handle.crumb` — section › item ›
 *   drill-in — then `› object` when something is open on it. Every level but
 *   the last links to its path; a tab is a query param, so it is never a level.
 * - Otherwise: `@username / pageLabel` (e.g. `@ravi-merugu / Graphs`), or,
 *   on an install-wide product's route, `@username ›` its route crumbs.
 * - If logged out, the leading user segment is dropped.
 * - More than four levels (`owner › graph` counts as one) collapse to the
 *   first · `…` · the last two; `…` opens a menu of the hidden levels.
 * - A long name truncates; its full text is on hover.
 */
export function useAppHeader(options: AppHeaderOptions = {}) {
	const {
		pageLabel,
		objectLabel,
		graphPicker,
		center,
		search,
		rightExtras,
		status,
		notifications,
		assistantToggle,
	} = options;
	const { pathname } = useLocation();
	const { user } = useAuth();
	const product = useActiveProduct();
	const routeCrumbs = useRouteCrumbs();

	const trail = computeTrail(pathname, user?.username, pageLabel, routeCrumbs);
	if (objectLabel) trail.levels.push({ label: objectLabel });
	const hasTrail = trail.lead.length + trail.levels.length > 0;

	return {
		// `relative` makes the header bar a positioning context so a `center`
		// consumer can dead-center its content against the full header width
		// (e.g. Explorer's canvas toolbar) rather than only within the leftover
		// space between the breadcrumb and the right-side controls.
		className: "!h-[38px] relative",
		left: (
			<div className="flex items-center gap-2 px-2 min-w-0">
				<Launcher />
				<Link
					to="/graphs"
					className="font-bold text-xl select-none hover:opacity-80 transition-opacity"
				>
					Invana {product?.name ?? "Studio"}
				</Link>
				{(hasTrail || graphPicker) && (
					<Separator orientation="vertical" className="h-4" />
				)}
				{graphPicker}
				{hasTrail && <HeaderBreadcrumb trail={trail} />}
			</div>
		),
		center,
		right: (
			<div className="flex items-center gap-4 px-2">
				{search ?? <SearchTrigger />}
				{rightExtras}
				<GitHubStars />
				{status ?? <GraphOnboardingCap />}
				<ThemeMenu />
				<FullscreenToggle />
				{notifications ?? <ActivityBell />}
				{assistantToggle}
				<UserMenu />
			</div>
		),
	};
}

// ─────────────────────────────────────────────────────────────────────────────
// Breadcrumb
// ─────────────────────────────────────────────────────────────────────────────

interface Segment {
	/** Display text. */
	label: string;
	/** Optional link target. Last segment is unlinked. */
	to?: string;
	/** Hover text when the label is shortened; the label otherwise. */
	title?: string;
}

/** `lead` names where the levels are — the Graph, or the signed-in user. */
interface Trail {
	lead: Segment[];
	levels: Segment[];
}

/** Levels shown before the middle collapses, the lead counting as one. */
const MAX_LEVELS = 4;

const SEPARATOR_CLASS =
	"shrink-0 text-muted-foreground/60 [&>svg]:h-3.5 [&>svg]:w-3.5";

function HeaderBreadcrumb({ trail }: { trail: Trail }) {
	const { lead, levels } = trail;
	const levelCount = (lead.length > 0 ? 1 : 0) + levels.length;
	const collapse = levelCount > MAX_LEVELS;
	const hidden = collapse ? levels.slice(0, -2) : [];
	const shown = collapse ? levels.slice(-2) : levels;
	const segments = [...lead, ...shown];
	// The `…` sits after the lead, before the last two levels.
	const ellipsisAt = collapse ? lead.length : -1;

	return (
		<Breadcrumb className="min-w-0 font-semibold">
			<BreadcrumbList className="flex-nowrap gap-1 sm:gap-1">
				{segments.map((s, i) => {
					const isLast = i === segments.length - 1;
					return (
						<Fragment
							key={`${s.label}-${
								// biome-ignore lint/suspicious/noArrayIndexKey: the list is rebuilt whole, never reordered in place
								i
							}`}
						>
							{i === ellipsisAt && (
								<>
									<BreadcrumbSeparator className={SEPARATOR_CLASS} />
									<HiddenLevels levels={hidden} />
								</>
							)}
							{i > 0 && <BreadcrumbSeparator className={SEPARATOR_CLASS} />}
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
											!isLast && "text-muted-foreground",
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
	const graphMatch = pathname.match(/^\/u\/([^/]+)\/([^/]+)(?:\/.*)?$/);
	if (graphMatch) {
		const [, owner, graphSlug] = graphMatch;
		// `owner › graph › …`. The owner and the graph are **not** dropped:
		// every graph-scoped screen is inside a graph, and a header that does not
		// name it leaves the URL as the only way to tell which one you are in.
		// This is what the hi-fi draws (`ExplorerHiFi`), and what both shell
		// references draw — design-kit's `Themes/AppV2 › ExplorerShell` and
		// canvas-ui's `apps/AppLayoutV2`.
		return {
			lead: [
				{ label: owner, to: "/graphs" },
				{ label: graphSlug, to: `/u/${owner}/${graphSlug}` },
			],
			levels: override ? [{ label: override }] : [...routeCrumbs],
		};
	}

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
