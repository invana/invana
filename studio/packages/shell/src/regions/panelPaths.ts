/**
 * The graph page's panels as paths — the product URLs of migration-plan §5.
 *
 * Every panel the page can open has a path under the Graph, named for the
 * product that will own it: `/u/:user/:graph/agents/llms/<provider>` is the
 * Agents panel, its LLMs section, drilled into one provider. The page still
 * reads its state as one set of search params (`panel`, `section`, and one
 * key per record), so this module converts in both directions:
 *
 * - `pageParamsOf(tail, search)` — the path read as the params it stands for,
 *   merged over the real query string. What the page's hooks read.
 * - `pageUrlOf(params)` — those params written back as a path plus whatever
 *   the path does not carry. What the page's hooks write.
 *
 * `pageUrlOf(pageParamsOf(…))` is the canonical URL. Any old `?panel=` link
 * (and the older `?settings=`, `?drawer=`) goes through the same pair and
 * lands on its path, so the redirect table is this file and nothing else.
 *
 * The path carries the panel, the stack section that holds the height, and
 * that section's drill-in. A drill-in held by another section of the same
 * stack stays in the query string, so no state is lost on the way.
 *
 * Param names are spelled here rather than imported: the hooks that own them
 * import this module.
 */

const PANEL = "panel";
const LEGACY_PANEL = "settings";
const SECTION = "section";
const LEGACY_SECTION = "drawer";
const TAB = "tab";
const RIGHT = "right";

interface PanelPath {
	/** Path under the Graph, without slashes at either end. */
	path: string;
	panel: string;
	/** The stack section this path opens; absent for a panel with none. */
	section?: string;
	/** The search key a trailing path segment fills. */
	detail?: string;
}

// Stacks list their sections in stack order, so the first is the default.
const PANEL_PATHS: readonly PanelPath[] = [
	{ path: "explorer", panel: "explorer", detail: "session" },
	// The Modeller's rail. Global model, Models and Stitches are three readings
	// of one panel, told apart by the section, so each keeps its own path.
	{ path: "modeller/global-model", panel: "model", section: "global" },
	{ path: "modeller/models", panel: "model", section: "models" },
	{ path: "modeller/stitches", panel: "model", section: "stitches" },
	{ path: "modeller/requests", panel: "requests" },
	{
		path: "modeller/worlds",
		panel: "govern",
		section: "worlds",
		detail: "world",
	},
	{
		path: "modeller/guardrails",
		panel: "govern",
		section: "guardrails",
		detail: "guardrail",
	},
	{ path: "modeller/rules", panel: "rules" },
	{ path: "modeller/settings", panel: "settings" },
	{ path: "agents/skills", panel: "skills" },
	{
		path: "agents/agents",
		panel: "agents",
		section: "agents",
		detail: "agent",
	},
	{ path: "agents/llms", panel: "agents", section: "llms", detail: "provider" },
	{
		path: "agents/library",
		panel: "library",
		section: "plans",
		detail: "plan",
	},
	{
		path: "agents/plugins/tasks",
		panel: "library",
		section: "catalogue",
		detail: "entry",
	},
	{
		path: "agents/templates",
		panel: "library",
		section: "templates",
		detail: "template",
	},
	// Activity's tabs (the shell's page). Runs and Events keep the panel keys
	// their rail icons write; the tabs with no panel share one key.
	{ path: "activity/inbox", panel: "activity", section: "inbox" },
	{ path: "activity/approvals", panel: "activity", section: "approvals" },
	{ path: "activity/runs", panel: "runs", detail: "run" },
	{ path: "activity/schedules", panel: "activity", section: "schedules" },
	{ path: "activity/events", panel: "events" },
	{ path: "activity/rules", panel: "activity", section: "rules" },
	{ path: "activity/channels", panel: "activity", section: "channels" },
	{
		path: "projects",
		panel: "projects",
		section: "projects",
		detail: "project",
	},
	{
		path: "projects/todos",
		panel: "projects",
		section: "todos",
		detail: "todo",
	},
];

// Info is a tab of Modeller's settings, not a path of its own.
const INFO_PATH = "modeller/settings";
const INFO_TAB = "info";

// A level with no panel of its own — a product's root, a breadcrumb's middle
// segment — opens the first section under it.
const LEVEL_LANDINGS: Record<string, string> = {
	modeller: "modeller/global-model",
	agents: "agents/agents",
	"agents/plugins": "agents/plugins/tasks",
	activity: "activity/runs",
};

// Retired and duplicate keys, onto the panel that holds what they named.
const ALIASES: Record<string, string> = {
	schema: "model",
	links: "model",
	llms: "agents",
	layers: "explorer",
	canvases: "explorer",
	connection: "settings",
};

// Sessions live in the assistant: the link opens Explorer with it on the right.
const ASSISTANT_PANELS = new Set(["sessions", "messages"]);

/** The Graph's own URL, `/u/:user/:graph`, and the tail after it. */
export function splitGraphPath(
	pathname: string,
): { root: string; tail: string } | null {
	const m = pathname.match(/^(\/u\/[^/]+\/[^/]+)(?:\/(.*?))?\/?$/);
	return m ? { root: m[1], tail: m[2] ?? "" } : null;
}

/** The path a tail matches, and the drill-in segment after it, if any. */
function matchTail(tail: string): { entry: PanelPath; id?: string } | null {
	let best: { entry: PanelPath; id?: string } | null = null;
	for (const entry of PANEL_PATHS) {
		if (tail === entry.path) {
			if (!best || entry.path.length > best.entry.path.length) best = { entry };
			continue;
		}
		if (!entry.detail || !tail.startsWith(`${entry.path}/`)) continue;
		const rest = tail.slice(entry.path.length + 1);
		if (rest.includes("/")) continue;
		if (!best || entry.path.length > best.entry.path.length) {
			best = { entry, id: decodeURIComponent(rest) };
		}
	}
	return best;
}

/**
 * The page's params for a path tail under the Graph, over its query string.
 * The path wins over the keys it carries — except a `?panel=` (or
 * `?settings=`) in the query, which only an old link has, and which names
 * the place that link meant. An unknown tail adds nothing.
 */
export function pageParamsOf(tail: string, search: string): URLSearchParams {
	const params = new URLSearchParams(search);
	if (params.has(PANEL) || params.has(LEGACY_PANEL)) return params;
	const trimmed = tail.replace(/^\/+|\/+$/g, "");
	const matched = matchTail(LEVEL_LANDINGS[trimmed] ?? trimmed);
	if (!matched) return params;

	const { entry, id } = matched;
	if (entry.path === INFO_PATH && params.get(TAB) === INFO_TAB) {
		params.set(PANEL, "info");
		params.delete(TAB);
		return params;
	}
	params.set(PANEL, entry.panel);
	if (entry.section) {
		params.set(SECTION, entry.section);
		params.delete(LEGACY_SECTION);
	}
	if (entry.detail && id) params.set(entry.detail, id);
	return params;
}

/**
 * The page's params as a path tail and the query string that rides with it.
 * No panel, or an unknown one, is the Graph's own URL.
 */
export function pageUrlOf(params: URLSearchParams): {
	tail: string;
	search: URLSearchParams;
} {
	const search = new URLSearchParams(params);
	const raw = search.get(PANEL) ?? search.get(LEGACY_PANEL);
	search.delete(PANEL);
	search.delete(LEGACY_PANEL);
	if (raw === null) return { tail: "", search };

	if (ASSISTANT_PANELS.has(raw)) {
		if (!search.has(RIGHT)) search.set(RIGHT, "assistant");
		return { tail: "explorer", search };
	}
	if (raw === "info") {
		search.set(TAB, INFO_TAB);
		return { tail: INFO_PATH, search };
	}

	const panel = ALIASES[raw] ?? raw;
	const entries = PANEL_PATHS.filter((e) => e.panel === panel);
	if (entries.length === 0) return { tail: "", search };

	let entry = entries[0];
	if (entry.section) {
		const wanted = search.get(SECTION) ?? search.get(LEGACY_SECTION);
		entry = entries.find((e) => e.section === wanted) ?? entries[0];
		search.delete(SECTION);
		search.delete(LEGACY_SECTION);
	}
	const id = entry.detail ? search.get(entry.detail) : null;
	if (entry.detail) search.delete(entry.detail);
	return {
		tail: id ? `${entry.path}/${encodeURIComponent(id)}` : entry.path,
		search,
	};
}

/** `root` + tail + query, as one string. */
export function joinPageUrl(
	root: string,
	{ tail, search }: { tail: string; search: URLSearchParams },
): string {
	const query = search.toString();
	return `${tail ? `${root}/${tail}` : root}${query ? `?${query}` : ""}`;
}

function sortedQuery(search: URLSearchParams): string {
	const copy = new URLSearchParams(search);
	copy.sort();
	return copy.toString();
}

/**
 * Where a location on a Graph should be instead — an old `?panel=` link, a
 * product's bare root — or null when it is already canonical (or off a
 * Graph). Key order is not a difference: a redirect remounts the page, so
 * only a different place earns one.
 */
export function canonicalRedirect(
	pathname: string,
	search: string,
): string | null {
	const split = splitGraphPath(pathname);
	if (!split) return null;
	const target = pageUrlOf(pageParamsOf(split.tail, search));
	const targetPath = target.tail ? `${split.root}/${target.tail}` : split.root;
	const samePath =
		decodeURIComponent(targetPath) === decodeURIComponent(pathname);
	const sameQuery =
		sortedQuery(target.search) === sortedQuery(new URLSearchParams(search));
	return samePath && sameQuery ? null : joinPageUrl(split.root, target);
}
