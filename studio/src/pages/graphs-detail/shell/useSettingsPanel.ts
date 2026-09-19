import { useCallback, useSyncExternalStore } from "react";
import { useSearchParams } from "react-router-dom";

// The left panel is a single-open accordion driven by one `?panel` param.
// **No value means no left column.** `explorer` is a key like every other, so
// the Explorer's type list closes the same way it opens; the resting page is a
// canvas with the rail beside it and nothing docked.
// Most values are the bottom-rail settings sections; the rest are page-owned
// view panels. They share the same param so the whole rail is mutually
// exclusive with the exact same toggle as the bottom items — the page (via
// GraphDetail) renders its own panel for these instead of the SettingsPanel.
//
// With the work surfaces (docs/for-developers/modules/work/spec.md) the page-owned set is sessions ·
// model · projects · tasks · agents — because every new
// noun opens in the left panel and paints on the canvas rather than getting a
// page of its own. `schema` and `messages` are leftovers from the one-page decision (docs/for-developers/modules/explore/spec.md): the
// separate Modeller page is retired, so `schema` redirects onto `model` and
// `messages` onto `sessions`.
export type SettingsSection =
	| "info"
	| "explorer"
	| "connection"
	// Retained as a *read* key, never written: the providers are a tab of
	// Settings now (G29), and `SettingsPanel` resolves this onto it so every old
	// bookmark lands on the tab that holds them.
	| "llms"
	| "skills"
	| "settings"
	| "events"
	| "sessions"
	| "schema"
	| "model"
	| "templates"
	| "canvases"
	| "messages"
	| "projects"
	| "tasks"
	| "agents";

const DEFAULT_SECTION: SettingsSection = "info";

// One param per axis of the page (graph-detail-page.md G16):
//
//   ?panel=  the left column's open section — this hook
//   ?page=   what fills mainSection (the canvas pages strip)
//   ?right=  who holds rightSection — assistant | inspector, absent is closed
//
// `?settings=` was this param's first name, from when every value in it was a
// settings section. Most are not — Model, Templates, Projects, Tasks and Agents
// are the page's own panels — so the param is named for the region it drives
// rather than for the group that used to fill it. The old name is still
// **read**, so a bookmark keeps working; it is never written.
const PANEL_PARAM = "panel";
const LEGACY_PANEL_PARAM = "settings";

// A stacked panel's own keys (useDrawerStack): which drawer holds the height,
// and what is drilled into inside it (G31). **Tasks** (Runs · Plans ·
// Catalogue) and **Projects** (Projects · Todos) are the two stacks. These are
// dropped whenever the section changes, exactly as `?tab=` is — a run left in
// the URL under a different rail icon names a drawer that is not on screen.
const STACK_PARAMS = [
	"drawer",
	"run",
	"plan",
	"entry",
	"project",
	"todo",
] as const;

// Which stack keys belong to which section. A write names one section, so every
// key that is not that section's is dropped — switching from Tasks to Projects
// must not leave `&run=` behind, and `?drawer=runs` is not a Projects drawer.
const STACK_KEYS_OF: Partial<Record<SettingsSection, readonly string[]>> = {
	tasks: ["drawer", "run", "plan", "entry"],
	projects: ["drawer", "project", "todo"],
};

// A panel whose content is itself tabbed says which tab through `?tab=`. Only
// Settings uses it today (Basic · Graph · LLMs · Agents), and it exists so a
// step in the setup timeline can send someone to the tab that holds the field
// it is asking for rather than to the panel and a second click. It is dropped
// whenever the section changes without naming one, so a stale tab never leaks
// into the next panel.
const TAB_PARAM = "tab";

// Allow-list of valid sections. The `panel` search param is user-controlled
// (and can point at removed sections from stale links/bookmarks), so anything
// not in this set falls back to DEFAULT_SECTION rather than crashing the render
// on an undefined section lookup.
const KNOWN_SECTIONS: readonly SettingsSection[] = [
	"info",
	"explorer",
	"connection",
	"llms",
	"skills",
	"settings",
	"events",
	"sessions",
	"schema",
	"model",
	"templates",
	"canvases",
	"messages",
	"projects",
	"tasks",
	"agents",
];

// Retired keys, kept as aliases so a bookmark lands on the panel that now holds
// the thing it named rather than on nothing. These are values of `?panel`; the
// param's own old name is handled by LEGACY_PANEL_PARAM above.
//
// **`imports`, `workflows`, `datasets` and `runs` are not here, and never
// will be.** They name surfaces that no longer exist, and the flows behind them
// are folded into the Tasks stack in the same slice their panels are deleted —
// so they are **deleted, not redirected** (G31). A stale link lands on the graph
// page, which is what an unknown `?panel` has always done. No backward
// compatibility is kept anywhere in this refactor; a redirect table is a second
// vocabulary to maintain for links that are weeks old.
//
// docs/for-developers/modules/explore/spec.md retired the Modeller page, so its two panel keys now name panels
// that live on the one page.
const ALIASES: Partial<Record<string, SettingsSection>> = {
	schema: "model",
	// Stitching moved into the Model panel and the union became a page
	// (stitch-models.md · Surfaces). A bookmark lands on the panel that now
	// holds it rather than on nothing.
	links: "model",
	messages: "sessions",
	// Layers left the left column: it is a canvas control on the page strip
	// (graph-detail-page.md G18). A bookmark lands on the Explorer's type list —
	// the other panel that reads the canvas beside it.
	layers: "explorer",
	// The connection is a field group in the one settings form, not a page of its
	// own (docs/for-developers/modules/connect-and-model/features/connect-a-database.md CD6).
	// The key stays as an alias so a bookmark lands on the group rather than 404ing.
	connection: "settings",
};

// Expanded (full-width) state is non-URL local store — shared across the
// hook's consumers via a tiny subscribable. Survives section changes but
// not full reloads (intentional: deep-links should land in the docked view).
let expandedState = false;
const expandedListeners = new Set<() => void>();
const setExpandedState = (v: boolean) => {
	if (expandedState === v) return;
	expandedState = v;
	for (const l of expandedListeners) l();
};

/**
 * URL-backed state for the docked Settings panel.
 *
 * - `isOpen`    — true when the `panel` search param is present.
 * - `section`   — the selected section (defaults to "info").
 * - `tab`       — the open tab inside a tabbed section, or null.
 * - `expanded`  — true when the panel is shown at full width (in-memory).
 * - `open(section?)`     — sets `?panel=<section>`.
 * - `setSection(s, tab?)` — switches section (and tab) without closing.
 * - `toggleExpanded()`   — flips the in-memory expanded flag.
 * - `close()`            — removes `?panel` from URL and resets expanded.
 *
 * Every write drops the legacy `?settings` key alongside setting `?panel`. A
 * link that arrives with the old name is honoured once and then normalised, so
 * two keys never disagree about which panel is open.
 */
export function useSettingsPanel() {
	const [params, setParams] = useSearchParams();
	const raw = params.get(PANEL_PARAM) ?? params.get(LEGACY_PANEL_PARAM);
	const tab = params.get(TAB_PARAM);
	const isOpen = raw !== null;
	const resolved = raw ? (ALIASES[raw] ?? raw) : raw;
	const section =
		resolved && KNOWN_SECTIONS.includes(resolved as SettingsSection)
			? (resolved as SettingsSection)
			: DEFAULT_SECTION;

	const expanded = useSyncExternalStore(
		(cb) => {
			expandedListeners.add(cb);
			return () => expandedListeners.delete(cb);
		},
		() => expandedState,
		() => false,
	);

	const write = useCallback(
		(s: SettingsSection, t?: string) => {
			const next = new URLSearchParams(params);
			next.set(PANEL_PARAM, s);
			next.delete(LEGACY_PANEL_PARAM);
			if (t) next.set(TAB_PARAM, t);
			else next.delete(TAB_PARAM);
			const keep = STACK_KEYS_OF[s] ?? [];
			for (const p of STACK_PARAMS) if (!keep.includes(p)) next.delete(p);
			setParams(next, { replace: true });
		},
		[params, setParams],
	);

	const open = useCallback(
		(s: SettingsSection = DEFAULT_SECTION, t?: string) => write(s, t),
		[write],
	);

	const setSection = useCallback(
		(s: SettingsSection, t?: string) => write(s, t),
		[write],
	);

	const toggleExpanded = useCallback(() => {
		setExpandedState(!expandedState);
	}, []);

	const close = useCallback(() => {
		setExpandedState(false);
		const next = new URLSearchParams(params);
		next.delete(PANEL_PARAM);
		next.delete(LEGACY_PANEL_PARAM);
		next.delete(TAB_PARAM);
		for (const p of STACK_PARAMS) next.delete(p);
		setParams(next, { replace: true });
	}, [params, setParams]);

	return {
		isOpen,
		section,
		tab,
		expanded,
		open,
		setSection,
		toggleExpanded,
		close,
	};
}
