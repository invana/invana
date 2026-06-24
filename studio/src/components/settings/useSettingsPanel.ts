import { useCallback, useSyncExternalStore } from "react";
import { useSearchParams } from "react-router-dom";

export type SettingsSection =
	| "info"
	| "connection"
	| "llms"
	| "skills"
	| "settings"
	| "datasets"
	| "events";

const DEFAULT_SECTION: SettingsSection = "info";

const SETTINGS_PARAM = "settings";

// Allow-list of valid sections. The `settings` search param is user-controlled
// (and can point at removed sections from stale links/bookmarks), so anything
// not in this set falls back to DEFAULT_SECTION rather than crashing the render
// on an undefined section lookup.
const KNOWN_SECTIONS: readonly SettingsSection[] = [
	"info",
	"connection",
	"llms",
	"skills",
	"settings",
	"datasets",
	"events",
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
 * - `isOpen`    — true when the `settings` search param is present.
 * - `section`   — the selected section (defaults to "info").
 * - `expanded`  — true when the panel is shown at full width (in-memory).
 * - `open(section?)`     — sets `?settings=<section>`.
 * - `setSection(s)`      — switches to a different section without closing.
 * - `toggleExpanded()`   — flips the in-memory expanded flag.
 * - `close()`            — removes `?settings` from URL and resets expanded.
 */
export function useSettingsPanel() {
	const [params, setParams] = useSearchParams();
	const raw = params.get(SETTINGS_PARAM);
	const isOpen = raw !== null;
	const section =
		raw && KNOWN_SECTIONS.includes(raw as SettingsSection)
			? (raw as SettingsSection)
			: DEFAULT_SECTION;

	const expanded = useSyncExternalStore(
		(cb) => {
			expandedListeners.add(cb);
			return () => expandedListeners.delete(cb);
		},
		() => expandedState,
		() => false,
	);

	const open = useCallback(
		(s: SettingsSection = DEFAULT_SECTION) => {
			const next = new URLSearchParams(params);
			next.set(SETTINGS_PARAM, s);
			setParams(next, { replace: true });
		},
		[params, setParams],
	);

	const setSection = useCallback(
		(s: SettingsSection) => {
			const next = new URLSearchParams(params);
			next.set(SETTINGS_PARAM, s);
			setParams(next, { replace: true });
		},
		[params, setParams],
	);

	const toggleExpanded = useCallback(() => {
		setExpandedState(!expandedState);
	}, []);

	const close = useCallback(() => {
		setExpandedState(false);
		const next = new URLSearchParams(params);
		next.delete(SETTINGS_PARAM);
		setParams(next, { replace: true });
	}, [params, setParams]);

	return { isOpen, section, expanded, open, setSection, toggleExpanded, close };
}
