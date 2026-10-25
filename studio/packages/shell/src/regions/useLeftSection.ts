import { useCallback, useSyncExternalStore } from "react";
import { usePageParams } from "./usePageParams";
import { LEGACY_SECTION_PARAM, SECTION_PARAM } from "./useStackSections";

// The left panel is a single-open accordion driven by one `panel` param. The
// URL spells it as a path — `/u/:user/:graph/agents/llms` — and `usePageParams`
// reads that path back as `panel` and its stack keys (`panelPaths`), so every
// key below is the name a path stands for, never something a link carries:
// an old `?panel=` link, its retired keys included, is redirected to its path
// before any page reads it (`<CanonicalRoute>`). **No value means no left
// column.** The product host draws its own panel for a product's key and the
// SettingsViewPanel for Info and Graph settings.
//
// A write names a key, and the path it lands on may belong to another place:
// `runs` and `events` are Activity's tabs, and `sessions` is Explorer with the
// assistant on the right.
export type LeftNavKey =
	| "info"
	| "explorer"
	| "skills"
	| "settings"
	| "events"
	| "sessions"
	| "model"
	| "projects"
	| "runs"
	| "govern"
	| "agents"
	// The Modeller's requests and rules.
	| "requests"
	| "rules"
	// The Agents rail's sections, each a page.
	| "home"
	| "fleet"
	| "approvals"
	| "ledger"
	| "functions"
	| "connections"
	| "llms"
	| "performance"
	| "concurrency"
	// The IAM rail's sections, each a page.
	| "iam-home"
	| "iam-people"
	| "iam-groups"
	| "iam-agents"
	| "iam-policies"
	| "iam-tokens"
	| "iam-settings"
	// The Projects rail's Decisions, a panel of its own.
	| "decisions"
	// Activity's tabs that no rail icon writes; `?section=` names the tab.
	| "activity";

const DEFAULT_SECTION: LeftNavKey = "info";

// One param per axis of the page (graph-detail-page.md):
//
//   ?panel=  the left column's open section — this hook
//   ?page=   what fills mainSection (the canvas pages strip)
//   ?right=  who holds rightSection — assistant | inspector, absent is closed
//
// `?settings=` was this param's first name, from when every value in it was a
// settings section. Most are not — Model, Projects, Runs, Library and Agents
// are the page's own panels — so the param is named for the region it drives
// rather than for the group that used to fill it. The old name is still
// **read**, so a bookmark keeps working; it is never written.
export const PANEL_PARAM = "panel";
export const LEGACY_PANEL_PARAM = "settings";

// A stacked panel's own keys (useStackSections): which section holds the height,
// and what is drilled into inside it. **Projects** (Projects · Todos) and
// **Govern** (Worlds · Guardrails) are stacks;
// **Runs** is a list, so it carries `run` and no `sectionKey`. These are
// dropped whenever the section changes, exactly as `?tab=` is — a run left in
// the URL under a different rail icon names a body that is not on screen.
export const STACK_PARAMS = [
	SECTION_PARAM,
	LEGACY_SECTION_PARAM,
	"run",
	"project",
	"todo",
	"world",
	"guardrail",
	"provider",
] as const;

// Which stack keys belong to which section. A write names one section, so every
// key that is not that section's is dropped — switching from Runs to Projects
// must not leave `&run=` behind, and `?section=plans` is not a Projects section.
const STACK_KEYS_OF: Partial<Record<LeftNavKey, readonly string[]>> = {
	// Runs takes no `?section=` — one list, so there is nothing to choose between.
	runs: ["run"],
	projects: [SECTION_PARAM, "project", "todo"],
	// **Govern** is the third stack — Worlds over Guardrails. Both keys
	// name a `Lens` id, because a guardrail and a world are one record separated
	// by `kind`; they are two keys because reading the ceiling is not
	// reading the world drawn inside it.
	govern: [SECTION_PARAM, "world", "guardrail"],
	// The Agents sections with tabs say which through `?section=`; LLMs drills
	// into the endpoint its modal opens.
	fleet: [SECTION_PARAM],
	performance: [SECTION_PARAM],
	functions: [SECTION_PARAM],
	connections: [SECTION_PARAM],
	llms: ["provider"],
	// **Model** keeps `?section=` for which Modeller rail item reads it —
	// Global model, Models or Stitches — so a write never moves the path.
	model: [SECTION_PARAM],
	activity: [SECTION_PARAM],
};

// A panel whose content is itself tabbed says which tab through `?tab=`. Only
// Settings uses it today (Basic · Graph · LLMs · Agents), and it exists so a
// step in the setup timeline can send someone to the tab that holds the field
// it is asking for rather than to the panel and a second click. It is dropped
// whenever the section changes without naming one, so a stale tab never leaks
// into the next panel.
export const TAB_PARAM = "tab";

// Allow-list of valid sections. A path the table does not know reads as no
// key, and anything else falls back to DEFAULT_SECTION rather than crashing the
// render on an undefined section lookup.
const KNOWN_SECTIONS: readonly LeftNavKey[] = [
	"info",
	"explorer",
	"skills",
	"settings",
	"events",
	"sessions",
	"model",
	"projects",
	"runs",
	"govern",
	"agents",
	"requests",
	"rules",
	"home",
	"fleet",
	"approvals",
	"ledger",
	"functions",
	"connections",
	"llms",
	"performance",
	"concurrency",
	"iam-home",
	"iam-people",
	"iam-groups",
	"iam-agents",
	"iam-policies",
	"iam-tokens",
	"iam-settings",
	"decisions",
	"activity",
];

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
export function useLeftSection() {
	const [params, setParams] = usePageParams();
	const raw = params.get(PANEL_PARAM) ?? params.get(LEGACY_PANEL_PARAM);
	const tab = params.get(TAB_PARAM);
	const isOpen = raw !== null;
	const section =
		raw && KNOWN_SECTIONS.includes(raw as LeftNavKey)
			? (raw as LeftNavKey)
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
		(s: LeftNavKey, t?: string) => {
			const next = new URLSearchParams(params);
			next.set(PANEL_PARAM, s);
			next.delete(LEGACY_PANEL_PARAM);
			const keep = STACK_KEYS_OF[s] ?? [];
			// **A stacked panel has sections, not tabs.** The second argument names
			// whichever that section has, so one call — `setSection("agents",
			// "llms")` — sends the setup step to the section that holds the field it
			// is asking for, exactly as it sends it to a tab of Settings.
			const stacked = keep.includes(SECTION_PARAM);
			next.delete(TAB_PARAM);
			if (t && !stacked) next.set(TAB_PARAM, t);
			const legacy = next.get(LEGACY_SECTION_PARAM);
			if (stacked && legacy && !next.has(SECTION_PARAM)) {
				next.set(SECTION_PARAM, legacy);
			}
			for (const p of STACK_PARAMS) if (!keep.includes(p)) next.delete(p);
			if (t && stacked) next.set(SECTION_PARAM, t);
			setParams(next, { replace: true });
		},
		[params, setParams],
	);

	const open = useCallback(
		(s: LeftNavKey = DEFAULT_SECTION, t?: string) => write(s, t),
		[write],
	);

	const setSection = useCallback(
		(s: LeftNavKey, t?: string) => write(s, t),
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
