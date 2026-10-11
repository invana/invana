import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
	BreadcrumbPage,
	BreadcrumbSeparator,
	cn,
	Separator,
} from "@invana/ui";
import { useAuth } from "@invana-studio/core";
import { Fragment, type ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { useActiveProduct } from "../../products";
import { FullscreenToggle } from "../FullscreenToggle";
import { GitHubStars } from "../GitHubStars";
import { ThemeMenu } from "../ThemeMenu";
import { Launcher } from "./Launcher";
import { UserMenu } from "./UserMenu";

export interface AppHeaderOptions {
	/** Last breadcrumb segment for the current page. Defaults to a label
	 *  derived from the URL (Graphs, New graph, Profile, Settings). The graph
	 *  page passes none: its URL is the graph (graph-detail-page.md), so
	 *  `owner › graph` already names where you are. */
	pageLabel?: string;
	/** The object open on this screen — the canvas, the model, the agent. Drawn
	 *  as the last crumb: `owner › graph › Defence theme`. Omitted when the
	 *  screen holds nothing yet. */
	objectLabel?: string;
	/** The Graph picker slot, after the wordmark. */
	graphPicker?: ReactNode;
	/** Center content. Most pages won't need this. */
	center?: ReactNode;
	/** The ⌘K slot, first in `header.right`. */
	search?: ReactNode;
	/** Page-specific controls, left of the shared ones. */
	rightExtras?: ReactNode;
	/** Graph-scoped status, before the theme menu (the onboarding cap). */
	status?: ReactNode;
	/** The notifications slot. */
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
 * - Graph-scoped (`/u/:username/:graphSlug`): `owner › graph`, plus `› object`
 *   when something is open on it.
 * - Otherwise: `@username / pageLabel` (e.g. `@ravi-merugu / Graphs`).
 * - If logged out, the leading user segment is dropped.
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

	const segments = computeSegments(pathname, user?.username, pageLabel).concat(
		objectLabel ? [{ label: objectLabel }] : [],
	);

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
				{(segments.length > 0 || graphPicker) && (
					<Separator orientation="vertical" className="h-4" />
				)}
				{graphPicker}
				{segments.length > 0 && <HeaderBreadcrumb segments={segments} />}
			</div>
		),
		center,
		right: (
			<div className="flex items-center gap-4 px-2">
				{search}
				{rightExtras}
				<GitHubStars />
				{status}
				<ThemeMenu />
				<FullscreenToggle />
				{notifications}
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
	/** Render in muted style? Default true; the last (current) segment is bolder. */
	muted?: boolean;
}

function HeaderBreadcrumb({ segments }: { segments: Segment[] }) {
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
							{i > 0 && (
								<BreadcrumbSeparator className="shrink-0 text-muted-foreground/60 [&>svg]:h-3.5 [&>svg]:w-3.5" />
							)}
							<BreadcrumbItem className="min-w-0">
								{s.to && !isLast ? (
									<BreadcrumbLink asChild className="truncate">
										<Link to={s.to}>{s.label}</Link>
									</BreadcrumbLink>
								) : (
									<BreadcrumbPage
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

// ─────────────────────────────────────────────────────────────────────────────
// Path → segments
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Derive the breadcrumb segments from the URL. The `pageLabel` arg overrides
 * the last segment when callers want something more specific than the URL
 * yields (e.g. "Settings · LLMs" instead of just "Settings").
 */
function computeSegments(
	pathname: string,
	username: string | undefined,
	override?: string,
): Segment[] {
	const graphMatch = pathname.match(/^\/u\/([^/]+)\/([^/]+)(?:\/(.+?))?\/?$/);
	if (graphMatch) {
		const [, owner, graphSlug, rest] = graphMatch;
		const graphRoot = `/u/${owner}/${graphSlug}`;
		// `owner › graph › screen`. The owner and the graph are **not** dropped:
		// every graph-scoped screen is inside a graph, and a header that does not
		// name it leaves the URL as the only way to tell which one you are in.
		// This is what the hi-fi draws (`ExplorerHiFi`), and what both shell
		// references draw — design-kit's `Themes/AppV2 › ExplorerShell` and
		// canvas-ui's `apps/AppLayoutV2`.
		const trail: Segment[] = [
			{ label: owner, to: "/graphs" },
			{ label: graphSlug, to: graphRoot },
		];
		return trail.concat(
			override ? [{ label: override }] : graphRestSegments(rest, graphRoot),
		);
	}

	// Non-graph routes (/graphs, /graphs/new, /settings/profile, /login, ...)
	const segments: Segment[] = [];
	if (username) {
		segments.push({ label: `@${username}`, to: "/graphs" });
	}
	const pageLabel = override ?? labelFromPlainPath(pathname);
	if (pageLabel) {
		segments.push({ label: pageLabel });
	}
	return segments;
}

/** Map the path tail under /u/:owner/:graphSlug to breadcrumb segments. */
function graphRestSegments(
	rest: string | undefined,
	graphRoot: string,
): Segment[] {
	// The graph's own URL *is* the page (graph-detail-page.md), so a missing
	// tail adds no third crumb — `owner › graph` already names where you are.
	// The page passes a `pageLabel` override for what is open on it.
	if (!rest) return [];
	if (rest === "settings") return [{ label: "Settings" }];
	const settingsSub = rest.match(/^settings\/(.+)$/);
	if (settingsSub) {
		return [
			{ label: "Settings", to: `${graphRoot}/settings` },
			{ label: capitalize(settingsSub[1]) },
		];
	}
	return [{ label: capitalize(rest) }];
}

function labelFromPlainPath(pathname: string): string | undefined {
	if (pathname === "/" || pathname === "/graphs") return "Graphs";
	if (pathname === "/graphs/new") return "New graph";
	if (pathname.startsWith("/settings/profile")) return "Profile";
	return undefined;
}

function capitalize(s: string): string {
	return s.length === 0 ? s : s[0].toUpperCase() + s.slice(1);
}
