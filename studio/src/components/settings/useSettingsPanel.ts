import { useCallback } from "react";
import { useSearchParams } from "react-router-dom";

export type SettingsSection =
	| "info"
	| "intent"
	| "llms"
	| "skills"
	| "instructions"
	| "datasets"
	| "members"
	| "invitations";

const DEFAULT_SECTION: SettingsSection = "info";

const SETTINGS_PARAM = "settings";

/**
 * URL-backed state for the docked Settings panel.
 *
 * - `isOpen`  — true when the `settings` search param is present.
 * - `section` — the selected section (defaults to "info").
 * - `open(section?)`  — sets `?settings=<section>` (replaces history entry).
 * - `setSection(s)`   — switches to a different section without closing.
 * - `close()`         — removes `?settings` from the URL.
 *
 * The full-page routes at `/u/:username/:graphSlug/settings/<section>` are the
 * "maximize" targets — built independently of this hook.
 */
export function useSettingsPanel() {
	const [params, setParams] = useSearchParams();
	const raw = params.get(SETTINGS_PARAM);
	const isOpen = raw !== null;
	const section = (raw as SettingsSection | null) ?? DEFAULT_SECTION;

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

	const close = useCallback(() => {
		const next = new URLSearchParams(params);
		next.delete(SETTINGS_PARAM);
		setParams(next, { replace: true });
	}, [params, setParams]);

	return { isOpen, section, open, setSection, close };
}
