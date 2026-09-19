import { FullscreenToggle } from "@/components/FullscreenToggle";
import { GitHubStars } from "@/components/GitHubStars";
import { ThemeMenu } from "@/components/ThemeMenu";
import { OnboardingCap } from "@/components/header/OnboardingCap";
import { useAuth } from "@/hooks/useAuth";
import { Separator } from "@invana/ui";
import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";

interface AppHeaderOptions {
	/** Last breadcrumb segment for the current page. Defaults to a label
	 *  derived from the URL (Graphs, New graph, Profile, Settings). The graph
	 *  page passes none: its URL is the graph (graph-detail-page.md G15), so
	 *  `owner › graph` already names where you are. */
	pageLabel?: string;
	/** The object open on this screen — the canvas, the model, the agent. Drawn
	 *  as the last crumb: `owner › graph › Defence theme`. Omitted when the
	 *  screen holds nothing yet. */
	objectLabel?: string;
	/** Drop the breadcrumb entirely — used when `leftExtras` already names the
	 *  current view, so the label would just be redundant. The separator still
	 *  renders before `leftExtras`. */
	hideBreadcrumb?: boolean;
	/** Extra content rendered to the right of the breadcrumb on the left side. */
	leftExtras?: ReactNode;
	/** Center content. Most pages won't need this. */
	center?: ReactNode;
	/** Extra controls rendered to the LEFT of ThemeMenu + UserMenu. Use for
	 *  page-specific buttons (e.g. Modeller's "Introspect" + "Refresh"). */
	rightExtras?: ReactNode;
	/** Panel collapse/expand toggles, rendered at the end of the right cluster
	 *  (e.g. Explorer/Modeller's sessions + inspector toggles). The profile menu
	 *  no longer lives here — it sits at the bottom of the left rail. */
	panelControls?: ReactNode;
}

/**
 * Shared AppLayoutV2 header config. Renders:
 *
 *   [Invana Studio] | breadcrumb [+ leftExtras]   [center]   [rightExtras] [GitHubStars] [OnboardingCap] [ThemeMenu] [FullscreenToggle] [panelControls]
 *
 * Breadcrumb behaviour (after the "Invana Studio" badge):
 * - Graph-scoped (`/u/:username/:graphSlug`): `owner › graph`, plus `› object`
 *   when something is open on it.
 * - Otherwise: `@username / pageLabel` (e.g. `@ravi-merugu / Graphs`).
 * - If logged out, the leading user segment is dropped.
 */
export function useAppHeader(options: AppHeaderOptions = {}) {
	const {
		pageLabel,
		objectLabel,
		hideBreadcrumb,
		leftExtras,
		center,
		rightExtras,
		panelControls,
	} = options;
	const { pathname } = useLocation();
	const { user } = useAuth();

	// The onboarding cap is graph-scoped (setup.md SU19): a Graph has onboarding,
	// the Graphs list does not. The route is what says which graph, so the cap is
	// read off the same match the breadcrumb uses rather than threaded through
	// every caller.
	const graphRoute = pathname.match(/^\/u\/([^/]+)\/([^/]+)(?:\/|$)/);

	const segments = hideBreadcrumb
		? []
		: computeSegments(pathname, user?.username, pageLabel).concat(
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
				<Link
					to="/graphs"
					className="font-bold text-xl select-none hover:opacity-80 transition-opacity"
				>
					Invana Studio
				</Link>
				{(segments.length > 0 || leftExtras) && (
					<Separator orientation="vertical" className="h-4" />
				)}
				{segments.length > 0 && <Breadcrumb segments={segments} />}
				{leftExtras}
			</div>
		),
		center,
		right: (
			<div className="flex items-center gap-4 px-2">
				{rightExtras}
				<GitHubStars />
				{graphRoute && (
					<OnboardingCap username={graphRoute[1]} graphSlug={graphRoute[2]} />
				)}
				<ThemeMenu />
				<FullscreenToggle />
				{panelControls}
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

function Breadcrumb({ segments }: { segments: Segment[] }) {
	return (
		<nav
			className="flex items-center gap-1 min-w-0 font-semibold"
			aria-label="Breadcrumb"
		>
			{segments.map((s, i) => {
				const isLast = i === segments.length - 1;
				return (
					<span
						key={`${s.label}-${i}`}
						className="flex items-center gap-1 min-w-0"
					>
						{i > 0 && (
							<ChevronRight className="w-3.5 h-3.5 text-muted-foreground/60 shrink-0" />
						)}
						{s.to && !isLast ? (
							<Link
								to={s.to}
								className="text-muted-foreground hover:text-foreground transition-colors truncate"
							>
								{s.label}
							</Link>
						) : (
							<span
								className={
									isLast
										? "text-foreground truncate"
										: "text-muted-foreground truncate"
								}
							>
								{s.label}
							</span>
						)}
					</span>
				);
			})}
		</nav>
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
	// The graph's own URL *is* the page (graph-detail-page.md G15), so a missing
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
