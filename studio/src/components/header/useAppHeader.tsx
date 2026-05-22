import { Separator } from "@invana/ui";
import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { FullscreenToggle } from "../FullscreenToggle";
import { ThemeToggle } from "../ThemeToggle";
import { UserMenu } from "./UserMenu";

interface AppHeaderOptions {
	/** Last breadcrumb segment for the current page. Defaults to a label
	 *  derived from the URL (Graphs, Explorer, Modeller, Settings, etc.). */
	pageLabel?: string;
	/** Extra content rendered to the right of the breadcrumb on the left side. */
	leftExtras?: ReactNode;
	/** Center content. Most pages won't need this. */
	center?: ReactNode;
	/** Extra controls rendered to the LEFT of ThemeToggle + UserMenu. Use for
	 *  page-specific buttons (e.g. Modeller's "Introspect" + "Refresh"). */
	rightExtras?: ReactNode;
}

/**
 * Shared AppLayoutV2 header config. Renders:
 *
 *   [Invana Studio] | breadcrumb [+ leftExtras]            [center]            [rightExtras] [ThemeToggle] [UserMenu]
 *
 * Breadcrumb behaviour (after the "Invana Studio" badge):
 * - Graph-scoped (`/u/:username/:graphSlug[/...]`): `username / graphSlug / pageLabel`.
 *   Username + graphSlug are clickable (own graph list, graph overview).
 * - Otherwise: `@username / pageLabel` (e.g. `@ravi-merugu / Graphs`).
 * - If logged out, the leading user segment is dropped.
 */
export function useAppHeader(options: AppHeaderOptions = {}) {
	const { pageLabel, leftExtras, center, rightExtras } = options;
	const { pathname } = useLocation();
	const { user } = useAuth();

	const segments = computeSegments(pathname, user?.username, pageLabel);

	return {
		className: "!h-[38px]",
		left: (
			<div className="flex items-center gap-2 px-2 min-w-0">
				<Link
					to="/graphs"
					className="font-bold text-xl select-none hover:opacity-80 transition-opacity"
				>
					Invana Studio
				</Link>
				{segments.length > 0 && (
					<>
						<Separator orientation="vertical" className="h-4" />
						<Breadcrumb segments={segments} />
					</>
				)}
				{leftExtras}
			</div>
		),
		center,
		right: (
			<div className="flex items-center gap-2 px-2">
				{rightExtras}
				<FullscreenToggle />
				<ThemeToggle />
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

function Breadcrumb({ segments }: { segments: Segment[] }) {
	return (
		<nav className="flex items-center gap-1 min-w-0" aria-label="Breadcrumb">
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
										? "text-foreground font-medium truncate"
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
		const segments: Segment[] = [
			{ label: `@${owner}`, to: "/graphs" },
			{ label: graphSlug, to: `/u/${owner}/${graphSlug}` },
		];
		if (override) {
			segments.push({ label: override });
		} else {
			segments.push(...graphRestSegments(rest, `/u/${owner}/${graphSlug}`));
		}
		return segments;
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
	if (!rest) return [{ label: "Overview" }];
	if (rest === "explorer") return [{ label: "Explorer" }];
	if (rest === "modeller") return [{ label: "Modeller" }];
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
